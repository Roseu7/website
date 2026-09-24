import type { UmigameEnv } from "./env.server";

export type JevProviderName = "vercel" | "typesafe";

export interface JevAnswer {
  type?: "boolean" | "choice" | "score";
  probability?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  score?: number;
}

export interface JevEvaluationResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface JevEvaluationRequest {
  state: string;
  questions: Record<string, unknown>;
  model?: string;
}

const JEV_TIMEOUT_MS = 30_000;

class JevProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly provider: JevProviderName,
    readonly kind: string = String(status),
  ) {
    super(message);
  }
}

function normalizeProvider(value: string | undefined): JevProviderName {
  return value === "typesafe" ? "typesafe" : "vercel";
}

function requestWithModel(env: UmigameEnv, request: JevEvaluationRequest) {
  const model = env.JEV_MODEL?.trim();
  return model ? { ...request, model } : request;
}

async function parseJevResponse(
  response: Response,
  provider: JevProviderName,
): Promise<JevEvaluationResponse> {
  if (!response.ok) {
    // Upstream error bodies may echo the submitted puzzle truth or user input.
    throw new JevProviderError(
      `Jev API returned HTTP ${response.status}.`,
      response.status,
      response.status === 429 || response.status >= 500,
      provider,
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new JevProviderError("Jev API returned invalid JSON.", 502, true, provider);
  }
  return parsed as JevEvaluationResponse;
}

async function callVercelProvider(env: UmigameEnv, request: JevEvaluationRequest) {
  if (!env.JEV_API_TOKEN) {
    throw new JevProviderError("JEV_API_TOKEN is not configured.", 500, false, "vercel");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    const upstream = new Request("https://api.roseu.net/jev", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + env.JEV_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ translate: false, ...requestWithModel(env, request) }),
    });

    const response = env.API_SERVICE
      ? await env.API_SERVICE.fetch(upstream)
      : await fetch(upstream);
    return parseJevResponse(response, "vercel");
  } catch (error) {
    if (error instanceof JevProviderError) throw error;
    const timeout = error instanceof Error && error.name === "AbortError";
    throw new JevProviderError(
      error instanceof Error ? error.message : "Jev provider network error.",
      timeout ? 504 : 502,
      true,
      "vercel",
      timeout ? "timeout" : "network_error",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callTypesafeProvider(env: UmigameEnv, request: JevEvaluationRequest) {
  if (!env.TYPESAFE_API_KEY) {
    throw new JevProviderError("TYPESAFE_API_KEY is not configured.", 500, false, "typesafe");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + env.TYPESAFE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestWithModel(env, request)),
    });
    return parseJevResponse(response, "typesafe");
  } catch (error) {
    if (error instanceof JevProviderError) throw error;
    const timeout = error instanceof Error && error.name === "AbortError";
    throw new JevProviderError(
      error instanceof Error ? error.message : "Jev provider network error.",
      timeout ? 504 : 502,
      true,
      "typesafe",
      timeout ? "timeout" : "network_error",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callProvider(
  provider: JevProviderName,
  env: UmigameEnv,
  request: JevEvaluationRequest,
) {
  return provider === "typesafe"
    ? callTypesafeProvider(env, request)
    : callVercelProvider(env, request);
}

async function stateHash(state: string) {
  const bytes = new TextEncoder().encode(state);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function recordRun(
  env: UmigameEnv,
  data: {
    purpose: string;
    targetId?: string;
    provider: JevProviderName;
    fallbackUsed: boolean;
    primaryError?: string | null;
    response?: JevEvaluationResponse;
    latencyMs: number;
    status: string;
    state: string;
  },
) {
  try {
    await env.DB.prepare(
      `INSERT INTO jev_runs
        (id, purpose, target_id, model, input_tokens, output_tokens, latency_ms,
         status, state_hash, provider, fallback_used, primary_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      data.purpose,
      data.targetId ?? null,
      data.response?.model ?? env.JEV_MODEL ?? null,
      data.response?.usage?.inputTokens ?? 0,
      data.response?.usage?.outputTokens ?? 0,
      data.latencyMs,
      data.status,
      await stateHash(data.state),
      data.provider,
      data.fallbackUsed ? 1 : 0,
      data.primaryError ?? null,
      Date.now(),
    ).run();
  } catch (error) {
    console.error("Failed to record umigame Jev run.", error);
  }
}

export function isJevProviderConfigured(
  env: UmigameEnv,
  provider: JevProviderName,
) {
  return provider === "typesafe"
    ? Boolean(env.TYPESAFE_API_KEY)
    : Boolean(env.JEV_API_TOKEN);
}

export function getJevErrorKind(error: unknown) {
  return error instanceof JevProviderError
    ? error.kind
    : error instanceof Error
      ? error.message
      : String(error);
}

export async function evaluateWithJevProvider(
  env: UmigameEnv,
  purpose: string,
  targetId: string | undefined,
  request: JevEvaluationRequest,
  provider: JevProviderName,
) {
  const startedAt = Date.now();
  try {
    const response = await callProvider(provider, env, request);
    const latencyMs = Date.now() - startedAt;
    await recordRun(env, {
      purpose,
      targetId,
      provider,
      fallbackUsed: false,
      response,
      latencyMs,
      status: "ok",
      state: request.state,
    });
    return {
      response,
      provider,
      fallbackUsed: false as const,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await recordRun(env, {
      purpose,
      targetId,
      provider,
      fallbackUsed: false,
      primaryError: getJevErrorKind(error),
      latencyMs,
      status: "error",
      state: request.state,
    });
    throw error;
  }
}

export async function evaluateWithJev(
  env: UmigameEnv,
  purpose: string,
  targetId: string | undefined,
  request: JevEvaluationRequest,
) {
  const primary = normalizeProvider(env.JEV_PROVIDER);
  const fallbackRaw = env.JEV_FALLBACK_PROVIDER?.trim();
  const fallback = fallbackRaw ? normalizeProvider(fallbackRaw) : null;
  const startedAt = Date.now();

  try {
    const response = await callProvider(primary, env, request);
    const latencyMs = Date.now() - startedAt;
    await recordRun(env, {
      purpose,
      targetId,
      provider: primary,
      fallbackUsed: false,
      response,
      latencyMs,
      status: "ok",
      state: request.state,
    });
    return { response, provider: primary, fallbackUsed: false, latencyMs };
  } catch (error) {
    const providerError = error instanceof JevProviderError ? error : null;
    const canFallback =
      providerError?.retryable === true &&
      fallback !== null &&
      fallback !== primary;

    if (!canFallback) {
      await recordRun(env, {
        purpose,
        targetId,
        provider: primary,
        fallbackUsed: false,
        primaryError: providerError
          ? providerError.kind
          : error instanceof Error
            ? error.message
            : String(error),
        latencyMs: Date.now() - startedAt,
        status: "error",
        state: request.state,
      });
      throw error;
    }

    try {
      const response = await callProvider(fallback, env, request);
      const latencyMs = Date.now() - startedAt;
      await recordRun(env, {
        purpose,
        targetId,
        provider: fallback,
        fallbackUsed: true,
        primaryError: providerError.kind,
        response,
        latencyMs,
        status: "ok",
        state: request.state,
      });
      return { response, provider: fallback, fallbackUsed: true, latencyMs };
    } catch (fallbackError) {
      await recordRun(env, {
        purpose,
        targetId,
        provider: fallback,
        fallbackUsed: true,
        primaryError: providerError.kind,
        latencyMs: Date.now() - startedAt,
        status: "error",
        state: request.state,
      });
      throw fallbackError;
    }
  }
}

export function isRetryableJevError(error: unknown) {
  return error instanceof JevProviderError && error.retryable;
}
