import { data, type LoaderFunctionArgs } from "~/framework/http";

import { requireUmigameUser } from "~/utils/umigame/auth.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { listUserFirstPlayResults } from "~/utils/umigame/user.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
  const results = await listUserFirstPlayResults(db, user.id, requestedPage);
  return data(results, { headers: { "Cache-Control": "private, no-store" } });
}
