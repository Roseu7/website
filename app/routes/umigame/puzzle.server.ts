import { type LoaderFunctionArgs } from "~/framework/http";

import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";

import { listPuzzleComments } from "~/utils/umigame/comments.server";

import { formatPuzzlePublicId, getPublishedPuzzlePublicById, getPuzzleFavoriteForUser, getPuzzleVoteForUser, parsePuzzlePublicId } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const rawId = params.id?.trim() ?? "";
  const publicId = parsePuzzlePublicId(rawId);
  if (!publicId || rawId !== formatPuzzlePublicId(publicId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const [puzzle, user] = await Promise.all([
    getPublishedPuzzlePublicById(db, publicId),
    getOptionalUmigameUser(request, context),
  ]);
  if (!puzzle) throw new Response("Not Found", { status: 404 });
  const [comments, viewerVote, viewerFavorite] = await Promise.all([
    listPuzzleComments(db, puzzle.id, user?.id ?? null),
    user ? getPuzzleVoteForUser(db, puzzle.id, user.id) : Promise.resolve(null),
    user ? getPuzzleFavoriteForUser(db, puzzle.id, user.id) : Promise.resolve(false),
  ]);
  return { puzzle, user, comments, viewerVote, viewerFavorite };
}
