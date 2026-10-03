
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { logoutUmigame } from "~/utils/umigame/auth.server";

import { getUmigameEnv } from "~/utils/umigame/env.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("complete") !== "1") {
    return redirect("/games/umigame");
  }

  requireSameOriginRequest(request);

  const env = getUmigameEnv(context);
  return {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN ?? null,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  return logoutUmigame(request, context);
}
