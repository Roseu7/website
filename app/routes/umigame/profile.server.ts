
import { type LoaderFunctionArgs } from "~/framework/http";

import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";

import { listPublishedPuzzlesByAuthor } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { getUmigameProfileStats, getUmigameUserByUsername } from "~/utils/umigame/user.server";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const username = params.username?.trim() ?? "";
  if (!/^[a-z0-9_-]{3,64}$/i.test(username)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const user = await getUmigameUserByUsername(db, username);
  if (!user) throw new Response("Not Found", { status: 404 });

  const [viewer, stats, puzzles] = await Promise.all([
    getOptionalUmigameUser(request, context),
    getUmigameProfileStats(db, user.id),
    listPublishedPuzzlesByAuthor(db, user.id),
  ]);
  return { user, stats, puzzles, isOwner: viewer?.id === user.id };
}
