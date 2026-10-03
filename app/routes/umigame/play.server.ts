

import { type LoaderFunctionArgs } from "~/framework/http";

import { formatPuzzlePublicId, getPublishedPuzzlePublicById, parsePuzzlePublicId } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const rawId = params.id?.trim() ?? "";
  const publicId = parsePuzzlePublicId(rawId);
  if (!publicId || rawId !== formatPuzzlePublicId(publicId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getPublishedPuzzlePublicById(db, publicId);
  if (!puzzle) throw new Response("Not Found", { status: 404 });
  return { puzzle };
}
