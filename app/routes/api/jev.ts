import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getJevAccessIdentity } from "~/utils/jev/access.server";
import { readLimitedJson } from "~/utils/request-body.server";
import { isSameOriginRequest } from "~/utils/request-origin.server";
import type { UmigameEnv } from "~/utils/umigame/env.server";
import { reserveJevToolDailyQuota } from "~/utils/umigame/quota.server";
import { checkJevToolRateLimit } from "~/utils/umigame/rate-limit.server";

interface JevProxyEnv {
  JEV_API_TOKEN?: string;
  API_SERVICE?: Fetcher;
  UMIGAME_DB?: D1Database;
  UMIGAME_SESSION_SECRET?: string;
  JEV_TOOL_RATE_LIMITER?: RateLimit;
  JEV_DAILY_QUOTA_STARTS_AT?: string;
}

const JEV_API_URL = "https://api.roseu.net/jev";
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 40_000;

function getEnv(context: ActionFunctionArgs["context"]): JevProxyEnv {
  return (context.cloudflare?.env ?? {}) as JevProxyEnv;
}

function noStoreHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  };
}

function proxyError(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return Response.json(
    {
      error: {
        code,
        message,
        source: "website_proxy",
        ...details,
      },
    },
    {
      status,
      headers: noStoreHeaders(),
    }
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return proxyError("METHOD_NOT_ALLOWED", "POSTのみ利用できます。", 405);
  }

  if (!isSameOriginRequest(request)) {
    return proxyError("FORBIDDEN_ORIGIN", "このリクエスト元からは利用できません。", 403);
  }

  const identity = await getJevAccessIdentity(request, context);
  if (!identity) {
    return proxyError("LOGIN_REQUIRED", "Jevを利用するにはログインしてください。", 401);
  }

  const env = getEnv(context);
  const quotaEnv = env as unknown as UmigameEnv;
  if (!(await checkJevToolRateLimit(quotaEnv, identity.userId))) {
    return proxyError(
      "RATE_LIMITED",
      "Jevの利用回数が多すぎます。少し時間を空けてください。",
      429,
      { retryable: true },
    );
  }

  if (!env.JEV_API_TOKEN) {
    return proxyError(
      "SERVER_CONFIGURATION_ERROR",
      "website WorkerにJEV_API_TOKENが設定されていません。",
      500,
      { retryable: false }
    );
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_REQUEST_BODY_BYTES);
  } catch (error) {
    if (error instanceof Response && error.status === 413) {
      return proxyError("PAYLOAD_TOO_LARGE", "リクエストが大きすぎます。", 413);
    }
    return proxyError("INVALID_JSON", "JSONの読み込みに失敗しました。", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return proxyError("INVALID_REQUEST", "リクエスト形式が不正です。", 400);
  }

  const rawQuestions = (body as { questions?: unknown }).questions;
  const questionCount = rawQuestions && typeof rawQuestions === "object" && !Array.isArray(rawQuestions)
    ? Object.keys(rawQuestions).length
    : 1;
  const encodedBodyBytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  const quotaUnits = Math.max(1, questionCount) + Math.ceil(encodedBodyBytes / 8192) +
    ((body as { translate?: unknown }).translate === true ? 1 : 0);
  const quota = await reserveJevToolDailyQuota(
    quotaEnv,
    identity.userId,
    quotaUnits,
  );
  if (quota !== "reserved") {
    return quota === "limited"
      ? proxyError(
          "DAILY_QUOTA_REACHED",
          "本日分のJev利用枠を使い切りました。明日また利用してください。",
          429,
          { retryable: false },
        )
      : proxyError(
          "QUOTA_UNAVAILABLE",
          "Jevの利用枠を確認できませんでした。少し待ってから再試行してください。",
          503,
          { retryable: true },
        );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamRequest = new Request(JEV_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.JEV_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const response = env.API_SERVICE
      ? await env.API_SERVICE.fetch(upstreamRequest)
      : await fetch(upstreamRequest);

    if (!response.ok) {
      return proxyError(
        "JEV_API_ERROR",
        "Jevの判定に失敗しました。",
        response.status,
        {
          retryable: response.status >= 500 || response.status === 429,
          upstream_status: response.status,
        }
      );
    }

    const responseText = await response.text();
    let parsed: unknown = null;

    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = null;
      }
    }

    if (parsed !== null) {
      return Response.json(parsed, {
        status: response.status,
        headers: noStoreHeaders(),
      });
    }

    return proxyError(
      "INVALID_UPSTREAM_RESPONSE",
      "Jev APIから不正なレスポンスが返されました。",
      502,
      { retryable: true }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return proxyError(
        "JEV_API_TIMEOUT",
        "Jev APIへの接続がタイムアウトしました。",
        504,
        { retryable: true }
      );
    }

    return proxyError(
      "JEV_API_UNREACHABLE",
      "Jev APIへ接続できませんでした。",
      502,
      {
        retryable: true,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return proxyError(
    "METHOD_NOT_ALLOWED",
    `GET ${new URL(request.url).pathname} は利用できません。`,
    405
  );
}
