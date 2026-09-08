import type { AppLoadContext } from "react-router";
import type { HomeControlActionResult, PcPowerState, PcStatePayload } from "~/utils/home/types";

type MaybeString = string | undefined;

interface HomeControlEnv {
  WAKE_SERVICE_URL?: string;
  WAKE_SERVICE_ACCESS_CLIENT_ID?: string;
  WAKE_SERVICE_ACCESS_CLIENT_SECRET?: string;
  WAKE_SERVICE_HMAC_SECRET?: string;
  HOME_AGENT_URL?: string;
  HOME_AGENT_ACCESS_CLIENT_ID?: string;
  HOME_AGENT_ACCESS_CLIENT_SECRET?: string;
  HOME_AGENT_BEARER_TOKEN?: string;
  HOME_AGENT_HMAC_SECRET?: string;
}

interface SignedHeadersInit {
  method: string;
  url: string;
  body: string;
  secret?: string;
}

function getEnv(context: AppLoadContext): HomeControlEnv {
  return (context.cloudflare?.env ?? {}) as HomeControlEnv;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function sha256HmacBase64(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function buildSignedHeaders(init: SignedHeadersInit): Promise<Headers> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  if (!init.secret) {
    return headers;
  }

  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const payload = [timestamp, nonce, init.method.toUpperCase(), new URL(init.url).pathname, init.body].join("\n");
  const signature = await sha256HmacBase64(init.secret, payload);

  headers.set("X-Timestamp", timestamp);
  headers.set("X-Nonce", nonce);
  headers.set("X-Signature", signature);

  return headers;
}

function attachServiceAuth(headers: Headers, clientId?: MaybeString, clientSecret?: MaybeString, bearer?: MaybeString) {
  if (clientId && clientSecret) {
    headers.set("CF-Access-Client-Id", clientId);
    headers.set("CF-Access-Client-Secret", clientSecret);
  }
  if (bearer) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizePower(input: unknown): PcPowerState {
  if (input === "on" || input === true) return "on";
  if (input === "off" || input === false) return "off";
  return "unknown";
}

export async function fetchPcState(context: AppLoadContext): Promise<PcStatePayload> {
  const env = getEnv(context);
  const checkedAt = new Date().toISOString();

  if (!env.HOME_AGENT_URL) {
    return {
      power: "unknown",
      canWake: Boolean(env.WAKE_SERVICE_URL),
      canShutdown: false,
      source: "none",
      checkedAt,
      message: "HOME_AGENT_URL is not configured.",
    };
  }

  const baseUrl = trimTrailingSlash(env.HOME_AGENT_URL);
  const targetUrl = `${baseUrl}/pc/state`;
  const headers = await buildSignedHeaders({
    method: "GET",
    url: targetUrl,
    body: "",
    secret: env.HOME_AGENT_HMAC_SECRET,
  });
  attachServiceAuth(
    headers,
    env.HOME_AGENT_ACCESS_CLIENT_ID,
    env.HOME_AGENT_ACCESS_CLIENT_SECRET,
    env.HOME_AGENT_BEARER_TOKEN
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(targetUrl, { method: "GET", headers, signal: controller.signal, redirect: "manual" });
    if (!response.ok) {
      return {
        power: "unknown",
        canWake: Boolean(env.WAKE_SERVICE_URL),
        canShutdown: false,
        source: "derived",
        checkedAt,
        message: `Home Agent returned ${response.status}.`,
      };
    }

    const data = await response.json() as {
      power?: unknown;
      hostname?: unknown;
      uptimeSec?: unknown;
    };

    const power = normalizePower(data.power);
    return {
      power,
      canWake: Boolean(env.WAKE_SERVICE_URL) && power !== "on",
      canShutdown: power === "on",
      source: "home-agent",
      checkedAt,
      hostname: typeof data.hostname === "string" ? data.hostname : undefined,
      uptimeSec: typeof data.uptimeSec === "number" ? data.uptimeSec : undefined,
      message: power === "unknown" ? "Power state was not returned by Home Agent." : undefined,
    };
  } catch {
    return {
      power: "unknown",
      canWake: Boolean(env.WAKE_SERVICE_URL),
      canShutdown: false,
      source: "derived",
      checkedAt,
      message: "Home Agent is unreachable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function wakePc(context: AppLoadContext): Promise<HomeControlActionResult> {
  const env = getEnv(context);
  if (!env.WAKE_SERVICE_URL) {
    return { ok: false, message: "WAKE_SERVICE_URL is not configured." };
  }

  const targetUrl = trimTrailingSlash(env.WAKE_SERVICE_URL);
  const body = JSON.stringify({});
  const headers = await buildSignedHeaders({
    method: "POST",
    url: targetUrl,
    body,
    secret: env.WAKE_SERVICE_HMAC_SECRET,
  });
  attachServiceAuth(
    headers,
    env.WAKE_SERVICE_ACCESS_CLIENT_ID,
    env.WAKE_SERVICE_ACCESS_CLIENT_SECRET
  );

  try {
    const response = await fetchWithTimeout(targetUrl, {
      method: "POST",
      headers,
      body,
    }, 5000);

    if (!response.ok) {
      return { ok: false, message: `Wake service returned ${response.status}.` };
    }

    return { ok: true, message: "Wake request sent." };
  } catch {
    return { ok: false, message: "Wake service is unreachable." };
  }
}

export async function shutdownPc(context: AppLoadContext): Promise<HomeControlActionResult> {
  const env = getEnv(context);
  if (!env.HOME_AGENT_URL) {
    return { ok: false, message: "HOME_AGENT_URL is not configured." };
  }

  const targetUrl = `${trimTrailingSlash(env.HOME_AGENT_URL)}/pc/shutdown`;
  const body = JSON.stringify({ confirm: true });
  const headers = await buildSignedHeaders({
    method: "POST",
    url: targetUrl,
    body,
    secret: env.HOME_AGENT_HMAC_SECRET,
  });
  attachServiceAuth(
    headers,
    env.HOME_AGENT_ACCESS_CLIENT_ID,
    env.HOME_AGENT_ACCESS_CLIENT_SECRET,
    env.HOME_AGENT_BEARER_TOKEN
  );

  try {
    const response = await fetchWithTimeout(targetUrl, {
      method: "POST",
      headers,
      body,
    }, 5000);

    if (!response.ok) {
      return { ok: false, message: `Home Agent returned ${response.status}.` };
    }

    return { ok: true, message: "Shutdown request sent." };
  } catch {
    return { ok: false, message: "Home Agent is unreachable." };
  }
}
