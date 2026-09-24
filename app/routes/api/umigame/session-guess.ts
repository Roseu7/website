import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { readLimitedJson } from "~/utils/request-body.server";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import {
  appendPlayTurn,
  getPlayProgressStats,
  getPlaySession,
  recordFirstPlayResult,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { evaluateFinalAnswer } from "~/utils/umigame/game.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";
import { reserveUmigameDailyQuota } from "~/utils/umigame/quota.server";
import { checkGuessRateLimit } from "~/utils/umigame/rate-limit.server";

const MAX_BODY_BYTES = 12 * 1024;

export async function loader({}: LoaderFunctionArgs) {
  return jsonError(405, "METHOD_NOT_ALLOWED", "POSTのみ利用できます。");
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePost(request);
  const sessionId = params.id?.trim();
  if (!sessionId) {
    return jsonError(400, "INVALID_SESSION", "セッションIDが不正です。");
  }

  const actor = await resolveUmigameActor(request, context, false);
  const env = getUmigameEnv(context);
  if (!(await checkGuessRateLimit(env, request, actor))) {
    return jsonError(429, "RATE_LIMITED", "最終回答の送信回数が多すぎます。少し時間を空けてください。", true);
  }

  const db = requireUmigameDb(env);
  const session = await getPlaySession(db, sessionId, actor.actorId);
  if (!session) {
    return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
  }
  if (session.solvedAt) {
    const stats = await getPlayProgressStats(db, sessionId, session.startedAt, session.solvedAt);
    if (actor.user) {
      await recordFirstPlayResult(db, {
        userId: actor.user.id, puzzleId: session.puzzleId, sessionId,
        outcome: "solved", stats, completedAt: session.solvedAt,
      });
    }
    return jsonNoStore({
      correct: true,
      coverage: 1,
      missingCoreFactCount: 0,
      truth: session.canonicalTruth,
      stats,
    });
  }
  if (session.gaveUpAt) {
    return jsonError(409, "SESSION_FINISHED", "このプレイはギブアップ済みです。");
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch {
    return jsonError(400, "INVALID_JSON", "回答を読み取れませんでした。");
  }
  const text =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { text?: unknown }).text
      : null;
  if (typeof text !== "string" || text.trim().length === 0 || text.trim().length > 2000) {
    return jsonError(400, "INVALID_GUESS", "最終回答は1〜2000文字で入力してください。");
  }

  const quota = await reserveUmigameDailyQuota(
    env,
    request,
    actor,
    "ai",
    session.facts.length + 1,
  );
  if (quota !== "reserved") {
    return quota === "limited"
      ? jsonError(429, "DAILY_QUOTA_REACHED", "本日分のAI判定枠を使い切りました。明日また利用してください。", true)
      : jsonError(503, "QUOTA_UNAVAILABLE", "利用枠を確認できませんでした。少し待ってから再試行してください。", true);
  }

  try {
    const result = await evaluateFinalAnswer(env, session, text.trim());
    const appended = await appendPlayTurn(db, {
      sessionId,
      kind: "guess",
      userText: text.trim(),
      answerCode: result.correct ? "CORRECT" : "INCORRECT",
      probabilities: {
        facts: result.factProbabilities,
        contradiction: result.contradiction,
        coverage: result.coverage,
      },
      jevModel: result.model,
      inputTokens: result.inputTokens,
      ...(result.correct ? { finishAs: "solved" as const } : {}),
    });

    if (!appended) {
      const current = await getPlaySession(db, sessionId, actor.actorId);
      if (current?.solvedAt) {
        const stats = await getPlayProgressStats(db, sessionId, current.startedAt, current.solvedAt);
        if (actor.user) {
          await recordFirstPlayResult(db, {
            userId: actor.user.id,
            puzzleId: current.puzzleId,
            sessionId,
            outcome: "solved",
            stats,
            completedAt: current.solvedAt,
          });
        }
        return jsonNoStore({
          correct: true,
          coverage: 1,
          missingCoreFactCount: 0,
          truth: current.canonicalTruth,
          stats,
        });
      }
      if (current?.gaveUpAt) {
        return jsonError(409, "SESSION_FINISHED", "このプレイはギブアップ済みです。");
      }
      return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
    }

    let stats = null;
    if (result.correct) {
      const completed = await getPlaySession(db, sessionId, actor.actorId);
      if (!completed?.solvedAt) {
        return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
      }
      stats = await getPlayProgressStats(db, sessionId, session.startedAt, completed.solvedAt);
      if (actor.user) {
        await recordFirstPlayResult(db, {
          userId: actor.user.id,
          puzzleId: session.puzzleId,
          sessionId,
          outcome: "solved",
          stats,
          completedAt: completed.solvedAt,
        });
      }
    }

    return jsonNoStore({
      correct: result.correct,
      coverage: result.coverage,
      missingCoreFactCount: result.missingCoreFactCount,
      ...(result.correct
        ? { truth: session.canonicalTruth, stats }
        : {}),
    });
  } catch (error) {
    console.error("Umigame final-answer evaluation failed.", error);
    return jsonError(
      503,
      "JEV_UNAVAILABLE",
      "Jevによる判定に失敗しました。もう一度送信してください。",
      true,
    );
  }
}
