import {
  getClientIpPrefix,
  getClientRateLimitKey,
  getPrincipalRateLimitKey,
  type DailyQuotaActor,
} from "./quota.server";
import type { UmigameEnv } from "./env.server";

async function applyLimit(
  limiter: RateLimit | undefined,
  key: string | null,
) {
  if (!limiter || !key) return true;
  const result = await limiter.limit({ key });
  return result.success;
}

async function checkUserOrAnonymousIpLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
  action: string,
  userLimiter: RateLimit | undefined,
  anonymousIpLimiter: RateLimit | undefined,
) {
  if (actor.user?.id) {
    const secret = env.UMIGAME_SESSION_SECRET;
    const key = secret
      ? `umigame:${action}:user:${await getPrincipalRateLimitKey(secret, action, actor.user.id)}`
      : `umigame:${action}:user:${actor.user.id}`;
    return applyLimit(userLimiter, key);
  }

  const prefix = getClientIpPrefix(request);
  if (!prefix) return true;
  const key = await getClientRateLimitKey(request, env.UMIGAME_SESSION_SECRET, action);
  return applyLimit(anonymousIpLimiter, key);
}

async function checkAnonymousActorAndIpLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
  action: string,
  actorLimiter: RateLimit | undefined,
  userLimiter: RateLimit | undefined,
  anonymousIpLimiter: RateLimit | undefined,
) {
  if (actor.user?.id) {
    return checkUserOrAnonymousIpLimit(env, request, actor, action, userLimiter, undefined);
  }

  const actorAllowed = await applyLimit(
    actorLimiter,
    `umigame:${action}:actor:${actor.actorId}`,
  );
  if (!actorAllowed) return false;
  return checkUserOrAnonymousIpLimit(env, request, actor, action, undefined, anonymousIpLimiter);
}

export function checkQuestionRateLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
) {
  return checkAnonymousActorAndIpLimit(
    env,
    request,
    actor,
    "question",
    env.UMIGAME_QUESTION_RATE_LIMITER,
    env.UMIGAME_QUESTION_USER_RATE_LIMITER,
    env.UMIGAME_QUESTION_ANON_IP_RATE_LIMITER,
  );
}

export function checkGuessRateLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
) {
  return checkAnonymousActorAndIpLimit(
    env,
    request,
    actor,
    "guess",
    env.UMIGAME_GUESS_RATE_LIMITER,
    env.UMIGAME_GUESS_USER_RATE_LIMITER,
    env.UMIGAME_GUESS_ANON_IP_RATE_LIMITER,
  );
}

export function checkRecommendationRateLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
) {
  return checkAnonymousActorAndIpLimit(
    env,
    request,
    actor,
    "recommendation",
    env.UMIGAME_RECOMMEND_RATE_LIMITER,
    env.UMIGAME_RECOMMEND_USER_RATE_LIMITER,
    env.UMIGAME_RECOMMEND_ANON_IP_RATE_LIMITER,
  );
}

export function checkSessionStartRateLimit(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
) {
  return checkUserOrAnonymousIpLimit(
    env,
    request,
    actor,
    "session-start",
    env.UMIGAME_SESSION_START_USER_RATE_LIMITER,
    env.UMIGAME_SESSION_START_ANON_IP_RATE_LIMITER,
  );
}

export async function checkJevToolRateLimit(
  env: UmigameEnv,
  accessUserId: string,
) {
  const secret = env.UMIGAME_SESSION_SECRET;
  const hash = secret
    ? await getPrincipalRateLimitKey(secret, "jev-tool", accessUserId)
    : accessUserId;
  return applyLimit(env.JEV_TOOL_RATE_LIMITER, `jev:tool:user:${hash}`);
}

export async function checkDisplayNameRateLimit(
  env: UmigameEnv,
  userId: string,
) {
  if (!env.UMIGAME_GUESS_RATE_LIMITER) return true;
  const result = await env.UMIGAME_GUESS_RATE_LIMITER.limit({
    key: "umigame:display-name:" + userId,
  });
  return result.success;
}
