import type { AppLoadContext } from "react-router";

export interface UmigameEnv {
  DB: D1Database;
  API_SERVICE?: Fetcher;
  JEV_API_TOKEN?: string;
  TYPESAFE_API_KEY?: string;
  JEV_PROVIDER?: string;
  JEV_FALLBACK_PROVIDER?: string;
  JEV_MODEL?: string;
  JEV_DAILY_QUOTA_STARTS_AT?: string;
  JEV_VERCEL_INPUT_USD_PER_MILLION?: string;
  JEV_TYPESAFE_INPUT_USD_PER_MILLION?: string;
  UMIGAME_SESSION_SECRET?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  UMIGAME_ACCESS_AUD?: string;
  UMIGAME_QUESTION_RATE_LIMITER?: RateLimit;
  UMIGAME_GUESS_RATE_LIMITER?: RateLimit;
  UMIGAME_RECOMMEND_RATE_LIMITER?: RateLimit;
  UMIGAME_QUESTION_USER_RATE_LIMITER?: RateLimit;
  UMIGAME_QUESTION_ANON_IP_RATE_LIMITER?: RateLimit;
  UMIGAME_GUESS_USER_RATE_LIMITER?: RateLimit;
  UMIGAME_GUESS_ANON_IP_RATE_LIMITER?: RateLimit;
  UMIGAME_RECOMMEND_USER_RATE_LIMITER?: RateLimit;
  UMIGAME_RECOMMEND_ANON_IP_RATE_LIMITER?: RateLimit;
  UMIGAME_SESSION_START_USER_RATE_LIMITER?: RateLimit;
  UMIGAME_SESSION_START_ANON_IP_RATE_LIMITER?: RateLimit;
  JEV_TOOL_RATE_LIMITER?: RateLimit;
  UMIGAME_AI_QUEUE?: Queue<
    | {
        type: "puzzle_review";
        revisionId: string;
      }
    | {
        type: "comment_review";
        commentId: string;
      }
  >;
}

export function getUmigameEnvFromBindings(bindings: unknown): UmigameEnv {
  const raw = (bindings ?? {}) as Partial<UmigameEnv> & {
    UMIGAME_DB?: D1Database;
  };

  return {
    ...raw,
    DB: raw.UMIGAME_DB,
  } as UmigameEnv;
}

export function getUmigameEnv(context: AppLoadContext): UmigameEnv {
  return getUmigameEnvFromBindings(context.cloudflare?.env);
}

export function requireUmigameDb(env: UmigameEnv) {
  if (!env.DB) {
    throw new Response("Umigame database is not configured.", { status: 500 });
  }
  return env.DB;
}
