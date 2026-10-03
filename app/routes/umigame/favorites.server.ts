import { type LoaderFunctionArgs } from "~/framework/http";

import { requireUmigameUser } from "~/utils/umigame/auth.server";

import { listFavoritePuzzles } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzles = await listFavoritePuzzles(db, user.id);
  return { puzzles };
}
