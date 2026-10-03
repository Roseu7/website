import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { getAdminJevAnalytics, requireUmigameAdmin } from "~/utils/umigame/admin.server";

import { getUmigameEnv } from "~/utils/umigame/env.server";

import { getGoldenTestOverview, runGoldenTestBatch } from "~/utils/umigame/golden-test.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUmigameAdmin(request, context);
  const env = getUmigameEnv(context);
  const [analytics, golden] = await Promise.all([
    getAdminJevAnalytics(env),
    getGoldenTestOverview(env),
  ]);
  const url = new URL(request.url);
  return {
    analytics,
    golden,
    goldenNotice:
      url.searchParams.get("golden") === "done"
        ? "Golden Testを実行しました。"
        : null,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  await requireUmigameAdmin(request, context);
  await runGoldenTestBatch(getUmigameEnv(context));
  return redirect("/games/umigame/admin/jev?golden=done");
}
