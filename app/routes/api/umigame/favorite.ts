import type { ActionFunctionArgs } from "react-router";
import { readLimitedJson } from "~/utils/request-body.server";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import {
  getPublishedPuzzlePublicById,
  parsePuzzlePublicId,
  setPuzzleFavorite,
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
    return jsonError(401, "LOGIN_REQUIRED", "お気に入りにはログインが必要です。");
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch {
    return jsonError(400, "INVALID_JSON", "お気に入り状態を読み取れませんでした。");
  }

  const favorite =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { favorite?: unknown }).favorite
      : null;
  if (typeof favorite !== "boolean") {
    return jsonError(400, "INVALID_FAVORITE", "favorite はbooleanで指定してください。");
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getPublishedPuzzlePublicById(db, publicId);
  if (!puzzle) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }

  await setPuzzleFavorite(db, puzzle.id, user.id, favorite);
  return jsonNoStore({ favorite });
}
