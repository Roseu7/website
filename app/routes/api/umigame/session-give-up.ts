import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import {
  appendPlayTurn,
  getPlayProgressStats,
  getPlaySession,
  recordFirstPlayResult,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";

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
  const db = requireUmigameDb(env);
  const session = await getPlaySession(db, sessionId, actor.actorId);
  if (!session) {
    return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
  }

  if (session.solvedAt) {
    return jsonError(409, "SESSION_FINISHED", "このプレイはすでに正解しています。");
  }
  if (!session.gaveUpAt) {
    await appendPlayTurn(db, {
      sessionId,
      kind: "system",
      userText: "",
      answerCode: "GAVE_UP",
      finishAs: "gave_up",
    });
    const completed = await getPlaySession(db, sessionId, actor.actorId);
    if (!completed) {
      return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
    }
    if (completed.solvedAt) {
      return jsonError(409, "SESSION_FINISHED", "このプレイはすでに正解しています。");
    }
    if (!completed.gaveUpAt) {
      return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
    }
    session.gaveUpAt = completed.gaveUpAt;
  }

  const stats = await getPlayProgressStats(db, sessionId, session.startedAt, session.gaveUpAt!);
  if (actor.user) {
    await recordFirstPlayResult(db, {
      userId: actor.user.id,
      puzzleId: session.puzzleId,
      sessionId,
      outcome: "gave_up",
      stats,
      completedAt: session.gaveUpAt!,
    });
  }

  return jsonNoStore({
    gaveUp: true,
    truth: session.canonicalTruth,
    stats,
  });
}
