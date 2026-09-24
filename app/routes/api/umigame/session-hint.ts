import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import {
  getPlaySession,
  revealNextHint,
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

  const { actorId } = await resolveUmigameActor(request, context, false);
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const session = await getPlaySession(db, sessionId, actorId);
  if (!session) {
    return jsonError(404, "SESSION_NOT_FOUND", "プレイセッションが見つかりません。");
  }
  if (session.solvedAt || session.gaveUpAt) {
    return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
  }
  if (session.hints.length === 0) {
    return jsonError(409, "NO_HINTS", "この問題にはヒントがありません。");
  }

  try {
    const hint = await revealNextHint(db, sessionId, session.revisionId);
    if (!hint) {
      const current = await getPlaySession(db, sessionId, actorId);
      if (current?.solvedAt || current?.gaveUpAt) {
        return jsonError(409, "SESSION_FINISHED", "このプレイはすでに終了しています。");
      }
      return jsonError(409, "NO_MORE_HINTS", "表示できるヒントはすべて確認済みです。");
    }

    return jsonNoStore({
      hint,
      totalHints: session.hints.length,
    });
  } catch (error) {
    console.error("Umigame hint reveal failed.", error);
    return jsonError(
      503,
      "HINT_UNAVAILABLE",
      "ヒントを表示できませんでした。もう一度試してください。",
      true,
    );
  }
}
