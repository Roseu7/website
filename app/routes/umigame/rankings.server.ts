
import { type LoaderFunctionArgs } from "~/framework/http";

import { listPublishedPuzzleRankings } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireUmigameDb(getUmigameEnv(context));
  const rankings = await listPublishedPuzzleRankings(db, 10);
  return { rankings };
}
