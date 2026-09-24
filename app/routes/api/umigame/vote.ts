import type { ActionFunctionArgs } from "react-router";
import { readLimitedJson } from "~/utils/request-body.server";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import {
  getPublishedPuzzlePublicById,
  parsePuzzlePublicId,
  setPuzzleVote,
  type PuzzleVoteValue,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { jsonError, jsonNoStore, requirePut } from "~/utils/umigame/http.server";

const MAX_BODY_BYTES = 1024;

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePut(request);
  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }

  const user = await getOptionalUmigameUser(request, context);
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "評価にはログインが必要です。");
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch {
    return jsonError(400, "INVALID_JSON", "評価を読み取れませんでした。");
  }

  const value =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { value?: unknown }).value
      : null;
  if (value !== 1 && value !== -1 && value !== 0) {
    return jsonError(400, "INVALID_VOTE", "評価は1、-1、0のいずれかを指定してください。");
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getPublishedPuzzlePublicById(db, publicId);
  if (!puzzle) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }

  const viewerVote: PuzzleVoteValue | null = value === 0 ? null : value;
  const voteScore = await setPuzzleVote(db, puzzle.id, user.id, viewerVote);
  return jsonNoStore({ voteScore, viewerVote });
}
