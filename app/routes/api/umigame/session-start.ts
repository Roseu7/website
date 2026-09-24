import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import {
  createPlaySession,
  createOrResumeOpenPlaySessionForPuzzle,
  getPlaySession,
  getPlaySessionResumeData,
  getPublishedRevisionForPublicId,
  parsePuzzlePublicId,
  type PlaySessionState,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";
import { reserveUmigameDailyQuota } from "~/utils/umigame/quota.server";
import { checkSessionStartRateLimit } from "~/utils/umigame/rate-limit.server";

export async function loader({}: LoaderFunctionArgs) {
  return jsonError(405, "METHOD_NOT_ALLOWED", "POSTのみ利用できます。");
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePost(request);
  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const revision = await getPublishedRevisionForPublicId(db, publicId);
  if (!revision) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }

  const actor = await resolveUmigameActor(request, context, true);
  if (!(await checkSessionStartRateLimit(env, request, actor))) {
    return jsonError(429, "RATE_LIMITED", "プレイ開始の回数が多すぎます。少し時間を空けてください。", true);
  }
  const quota = await reserveUmigameDailyQuota(env, request, actor, "sessions", 1);
  if (quota !== "reserved") {
    return quota === "limited"
      ? jsonError(429, "DAILY_QUOTA_REACHED", "本日分のプレイ開始枠を使い切りました。明日また利用してください。", true)
      : jsonError(503, "QUOTA_UNAVAILABLE", "利用枠を確認できませんでした。少し待ってから再試行してください。", true);
  }

  let session: PlaySessionState | null = null;
  let resumed = false;
  if (actor.user) {
    const startResult = await createOrResumeOpenPlaySessionForPuzzle(
      db,
      revision.puzzleId,
      revision.revisionId,
      actor.actorId,
    );
    session = startResult?.session ?? null;
    resumed = startResult?.resumed ?? false;
  } else {
    const sessionId = await createPlaySession(
      db,
      revision.revisionId,
      actor.actorId,
    );
    session = await getPlaySession(db, sessionId, actor.actorId);
  }
  if (!session) {
    return jsonError(
      503,
      "SESSION_START_FAILED",
      "プレイセッションを開始できませんでした。",
      true,
    );
  }

  const resumeData = resumed
    ? await getPlaySessionResumeData(db, session.sessionId)
    : { history: [], revealedHints: [] };

  const headers = new Headers({ "Cache-Control": "no-store" });
  if (actor.setCookie) headers.set("Set-Cookie", actor.setCookie);

  return jsonNoStore(
    {
      sessionId: session.sessionId,
      resumed,
      problem: {
        id: session.displayId,
        title: session.title,
        statement: session.statement,
        difficulty: session.difficulty,
        hintCount: session.hints.length,
      },
      history: resumeData.history,
      revealedHints: resumeData.revealedHints,
    },
    { status: resumed ? 200 : 201, headers },
  );
}
