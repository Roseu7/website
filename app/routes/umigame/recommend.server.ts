import { data, type ActionFunctionArgs } from "~/framework/http";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { resolveUmigameActor } from "~/utils/umigame/actor.server";

import { listRecommendationCandidates } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { reserveUmigameDailyQuota } from "~/utils/umigame/quota.server";

import { checkRecommendationRateLimit } from "~/utils/umigame/rate-limit.server";

import { recommendPuzzles } from "~/utils/umigame/recommendation.server";

const MAX_QUERY_LENGTH = 400;

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const query = String(form.get("query") ?? "").trim();

  if (!query) {
    return data(
      {
        query,
        error: "探したい問題の条件を入力してください。",
        recommendations: [],
        candidateCount: null,
      },
      { status: 400 },
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return data(
      {
        query,
        error: `条件は${MAX_QUERY_LENGTH}文字以内で入力してください。`,
        recommendations: [],
        candidateCount: null,
      },
      { status: 400 },
    );
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const actor = await resolveUmigameActor(request, context, true);

  if (!(await checkRecommendationRateLimit(env, request, actor))) {
    return data(
      {
        query,
        error: "おすすめ検索の利用回数が上限に達しました。少し時間を空けてください。",
        recommendations: [],
        candidateCount: null,
      },
      { status: 429 },
    );
  }

  const candidates = await listRecommendationCandidates(db, actor.actorId, 50);
  const headers = actor.setCookie
    ? { "Set-Cookie": actor.setCookie }
    : undefined;

  if (candidates.length === 0) {
    return data(
      {
        query,
        error: null,
        recommendations: [],
        candidateCount: 0,
      },
      { headers },
    );
  }

  const quota = await reserveUmigameDailyQuota(
    env,
    request,
    actor,
    "ai",
    candidates.length,
  );
  if (quota !== "reserved") {
    return data(
      {
        query,
        error: quota === "limited"
          ? "本日分のAI判定枠を使い切りました。明日また利用してください。"
          : "利用枠を確認できませんでした。少し待ってから再試行してください。",
        recommendations: [],
        candidateCount: candidates.length,
      },
      { status: quota === "limited" ? 429 : 503, headers },
    );
  }

  try {
    const recommendations = await recommendPuzzles(env, query, candidates, 10);
    return data(
      {
        query,
        error: null,
        recommendations,
        candidateCount: candidates.length,
      },
      { headers },
    );
  } catch (error) {
    console.error("Umigame recommendation failed.", error);
    return data(
      {
        query,
        error: "Jevでおすすめを判定できませんでした。もう一度試してください。",
        recommendations: [],
        candidateCount: candidates.length,
      },
      { status: 503, headers },
    );
  }
}
