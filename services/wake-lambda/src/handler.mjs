import { createHmac, timingSafeEqual } from "node:crypto";
import { createSocket } from "node:dgram";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const DEFAULT_TARGET_HOST = "mc.roseu.net";
const TARGET_PORT = 7779;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_ALLOWED_SKEW_MS = 30_000;
const DEFAULT_NONCE_TTL_SECONDS = 300;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 4_096;

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

class HttpError extends Error {
  constructor(statusCode, code, message = code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getHeader(headers, name) {
  const expected = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === expected) {
      return Array.isArray(value) ? value[0] : value ?? "";
    }
  }
  return "";
}

function getBody(event) {
  if (typeof event.body !== "string") return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function readConfig() {
  const hmacSecret = process.env.HMAC_SECRET?.trim() ?? "";
  const targetMac = process.env.TARGET_MAC?.trim() ?? "";
  const tableName = process.env.DDB_TABLE_NAME?.trim() ?? "";

  if (!hmacSecret) throw new Error("HMAC_SECRET is not configured");
  if (!targetMac) throw new Error("TARGET_MAC is not configured");
  if (!tableName) throw new Error("DDB_TABLE_NAME is not configured");

  return {
    hmacSecret,
    targetHost: DEFAULT_TARGET_HOST,
    targetMac,
    tableName,
    allowedSkewMs: readPositiveInt("ALLOWED_SKEW_MS", DEFAULT_ALLOWED_SKEW_MS),
    nonceTtlSeconds: readPositiveInt("NONCE_TTL_SECONDS", DEFAULT_NONCE_TTL_SECONDS),
    rateLimitWindowMs: readPositiveInt("RATE_LIMIT_WINDOW_MS", DEFAULT_RATE_LIMIT_WINDOW_MS),
    retryCount: readPositiveInt("RETRY_COUNT", DEFAULT_RETRY_COUNT),
    retryDelayMs: readPositiveInt("RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS),
  };
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function computeSignature(secret, timestamp, nonce, method, path, body) {
  const payload = [timestamp, nonce, method.toUpperCase(), path, body].join("\n");
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

function signaturesMatch(actual, expected) {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function validateRequest(headers, method, path, body, config, nowMs = Date.now()) {
  const timestamp = getHeader(headers, "X-Timestamp");
  const nonce = getHeader(headers, "X-Nonce");
  const signature = getHeader(headers, "X-Signature");
  if (!timestamp || !nonce || !signature) {
    throw new HttpError(401, "missing_signature_headers");
  }

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > config.allowedSkewMs) {
    throw new HttpError(401, "timestamp_out_of_range");
  }

  const expected = computeSignature(config.hmacSecret, timestamp, nonce, method, path, body);
  if (!signaturesMatch(signature, expected)) {
    throw new HttpError(403, "invalid_signature");
  }

  return { timestamp, nonce };
}

function isConditionalCheckFailed(error) {
  return error?.name === "ConditionalCheckFailedException";
}

async function reserveNonce(config, nonce, nowMs) {
  try {
    await dynamo.send(new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: `nonce#${nonce}`,
        expiresAt: Math.floor(nowMs / 1000) + config.nonceTtlSeconds,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }));
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

async function reserveRateLimit(config, nowMs) {
  try {
    await dynamo.send(new PutCommand({
      TableName: config.tableName,
      Item: {
        pk: "rate#desktop",
        lastAllowedAt: nowMs,
        expiresAt: Math.floor((nowMs + config.rateLimitWindowMs) / 1000),
      },
      ConditionExpression: "attribute_not_exists(lastAllowedAt) OR lastAllowedAt <= :threshold",
      ExpressionAttributeValues: {
        ":threshold": nowMs - config.rateLimitWindowMs,
      },
    }));
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

function parseMac(mac) {
  const normalized = mac.replace(/[:-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(normalized)) {
    throw new Error("TARGET_MAC is invalid");
  }
  return Buffer.from(normalized, "hex");
}

function buildMagicPacket(mac) {
  const hardwareAddress = parseMac(mac);
  const packet = Buffer.alloc(6 + hardwareAddress.length * 16, 0xff);
  for (let offset = 6; offset < packet.length; offset += hardwareAddress.length) {
    hardwareAddress.copy(packet, offset);
  }
  return packet;
}

function sendUdpPacket(packet, host, port) {
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // The socket can already be closed after an error.
      }
      if (error) reject(error);
      else resolve();
    };

    socket.once("error", finish);
    socket.send(packet, 0, packet.length, port, host, (error) => finish(error ?? undefined));
  });
}

async function sendMagicPacket(config, context) {
  const packet = buildMagicPacket(config.targetMac);
  for (let attempt = 0; attempt < config.retryCount; attempt += 1) {
    if (context?.getRemainingTimeInMillis && context.getRemainingTimeInMillis() < 1_000) {
      throw new Error("Lambda deadline is too close for UDP send");
    }
    await sendUdpPacket(packet, config.targetHost, TARGET_PORT);
    if (attempt + 1 < config.retryCount) {
      await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs));
    }
  }
}

export async function handler(event, context) {
  const method = event.requestContext?.http?.method?.toUpperCase() ?? "";
  const path = event.rawPath || event.requestContext?.http?.path || "/";

  if (method === "GET" && path === "/health") {
    return response(200, { ok: true });
  }

  if (method !== "POST" || path !== "/wake") {
    return response(405, { ok: false, error: "method_not_allowed" });
  }

  const body = getBody(event);
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return response(413, { ok: false, error: "body_too_large" });
  }

  let config;
  try {
    config = readConfig();
    const { nonce } = validateRequest(event.headers, method, path, body, config);
    const nowMs = Date.now();

    if (!(await reserveNonce(config, nonce, nowMs))) {
      return response(409, { ok: false, error: "replayed_nonce" });
    }
    if (!(await reserveRateLimit(config, nowMs))) {
      return response(429, { ok: false, error: "rate_limited" });
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return response(error.statusCode, { ok: false, error: error.code });
    }
    console.error("request validation failed", error instanceof Error ? error.message : error);
    return response(500, { ok: false, error: "validation_unavailable" });
  }

  try {
    await sendMagicPacket(config, context);
    return response(200, { ok: true, queued: true, target: "desktop" });
  } catch (error) {
    console.error("wake send failed", error instanceof Error ? error.message : error);
    return response(502, { ok: false, error: "wake_send_failed" });
  }
}

export const testing = {
  buildMagicPacket,
  computeSignature,
  parseMac,
  validateRequest,
};
