import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { readLimitedJson } from "~/utils/request-body.server";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import { appendPlayTurn, getPlaySession } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { evaluateGmQuestion } from "~/utils/umigame/game.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";
import { reserveUmigameDailyQuota } from "~/utils/umigame/quota.server";
import { checkQuestionRateLimit } from "~/utils/umigame/rate-limit.server";

const MAX_BODY_BYTES = 4 * 1024;

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
  if (!(await checkQuestionRateLimit(env, request, actor))) {
    return jsonError(429, "RATE_LIMITED", "質問の送信回数が多すぎます。少し時間を空けてください。", true);
  }

  const db = requireUmigameDb(env);
  const session = await getPlaySession(db, sessionId, actor.actorId);
  if (!session) {
    return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
  }
  if (session.solvedAt || session.gaveUpAt) {
    return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch {
    return jsonError(400, "INVALID_JSON", "質問を読み取れませんでした。");
  }
  const text =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { text?: unknown }).text
      : null;
  if (typeof text !== "string" || text.trim().length === 0 || text.trim().length > 500) {
    return jsonError(400, "INVALID_QUESTION", "質問は1〜500文字で入力してください。");
  }

  const quota = await reserveUmigameDailyQuota(env, request, actor, "ai", 1);
  if (quota !== "reserved") {
    return quota === "limited"
      ? jsonError(429, "DAILY_QUOTA_REACHED", "本日分のAI判定枠を使い切りました。明日また利用してください。", true)
      : jsonError(503, "QUOTA_UNAVAILABLE", "利用枠を確認できませんでした。少し待ってから再試行してください。", true);
  }

  try {
    const result = await evaluateGmQuestion(env, session, text.trim());
    const appended = await appendPlayTurn(db, {
      sessionId,
      kind: "question",
      userText: text.trim(),
      answerCode: result.code,
      probabilities: result.probabilities,
      jevModel: result.model,
      inputTokens: result.inputTokens,
    });
    if (!appended) {
      return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
    }
    return jsonNoStore({ answer: result.code });
  } catch (error) {
    console.error("Umigame GM evaluation failed.", error);
    return jsonError(
      503,
      "JEV_UNAVAILABLE",
      "Jevによる判定に失敗しました。もう一度送信してください。",
      true,
    );
  }
}
