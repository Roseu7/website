import type { UmigameEnv } from "./env.server";

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
}

const JEV_TIMEOUT_MS = 30_000;
const JEV_API_URL = "https://api.roseu.net/jev";

class JevProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly kind: string = String(status),
  ) {
    super(message);
  }
}
async function parseJevResponse(
  response: Response,
): Promise<JevEvaluationResponse> {
  if (!response.ok) {
    throw new JevProviderError(
      `Jev API returned HTTP ${response.status}.`,
      response.status,
      response.status === 429 || response.status >= 500,
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
    throw new JevProviderError(
      "Jev API returned invalid JSON.",
      502,
      true,
    );
  }
  return parsed as JevEvaluationResponse;
}

async function callJevApi(
  env: UmigameEnv,
  request: JevEvaluationRequest,
) {
  if (!env.JEV_API_TOKEN) {
    throw new JevProviderError(
      "JEV_API_TOKEN is not configured.",
      500,
      false,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    JEV_TIMEOUT_MS,
  );

  try {
    const upstream = new Request(JEV_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + env.JEV_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        translate: false,
        ...request,
      }),
    });

    const response = env.API_SERVICE
      ? await env.API_SERVICE.fetch(upstream)
      : await fetch(upstream);
    return parseJevResponse(response);
  } catch (error) {
    if (error instanceof JevProviderError) throw error;
    const timeout =
      error instanceof Error && error.name === "AbortError";
    throw new JevProviderError(
      error instanceof Error
        ? error.message
        : "Jev provider network error.",
      timeout ? 504 : 502,
      true,
      timeout ? "timeout" : "network_error",
    );
  } finally {
    clearTimeout(timer);
  }
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
      data.response?.model ?? null,
      data.response?.usage?.inputTokens ?? 0,
      data.response?.usage?.outputTokens ?? 0,
      data.latencyMs,
      data.status,
      await stateHash(data.state),
      "typesafe",
      0,
      data.primaryError ?? null,
      Date.now(),
    ).run();
  } catch (error) {
    console.error("Failed to record umigame Jev run.", error);
  }
}

export function isJevConfigured(env: UmigameEnv) {
  return Boolean(env.JEV_API_TOKEN);
}

export function getJevErrorKind(error: unknown) {
  return error instanceof JevProviderError
    ? error.kind
    : error instanceof Error
      ? error.message
      : String(error);
}
export async function evaluateWithJev(
  env: UmigameEnv,
  purpose: string,
  targetId: string | undefined,
  request: JevEvaluationRequest,
) {
  const startedAt = Date.now();
  try {
    const response = await callJevApi(env, request);
    const latencyMs = Date.now() - startedAt;
    await recordRun(env, {
      purpose,
      targetId,
      response,
      latencyMs,
      status: "ok",
      state: request.state,
    });
    return {
      response,
      provider: "typesafe" as const,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    await recordRun(env, {
      purpose,
      targetId,
      primaryError: getJevErrorKind(error),
      latencyMs,
      status: "error",
      state: request.state,
    });
    throw error;
  }
}

export function isRetryableJevError(error: unknown) {
  return error instanceof JevProviderError && error.retryable;
}
