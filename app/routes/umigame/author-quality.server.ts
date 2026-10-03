import { type LoaderFunctionArgs } from "~/framework/http";

import { requireUmigameUser } from "~/utils/umigame/auth.server";

import { getAuthorQualityAnalytics } from "~/utils/umigame/author-quality.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  return getAuthorQualityAnalytics(db, user);
}
