
import { type LoaderFunctionArgs } from "~/framework/http";

import { listPublishedPuzzleLicenses } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireUmigameDb(getUmigameEnv(context));
  const entries = await listPublishedPuzzleLicenses(db);
  return {
    licensed: entries.filter((entry) => entry.sourceType !== "original"),
  };
}
