import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { NotFoundBoundary } from "~/components/routing/NotFoundBoundary";
import { rewriteMapLocation } from "~/utils/map/proxy.server";

export { NotFoundBoundary as ErrorBoundary };

export async function loader({ request, context }: LoaderFunctionArgs) {
  const [
    { requireMcDashboardHost },
    { getMcSession },
    { getMcDashboardEnv, requireMcEnvValue, requireOwnerDiscordUser },
    { getActiveMinecraftLink, getServerState },
    { isMcServerOnline },
  ] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
      import("~/utils/mc/dashboard"),
    ]);

  requireMcDashboardHost(request);
  const incomingUrl = new URL(request.url);
  if (incomingUrl.pathname === "/map") {
    return redirect("/map/");
  }

  const session = await getMcSession(request, context);
  const discordUserId = session.get("discordUserId");
  const env = getMcDashboardEnv(context);
  if (!discordUserId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  requireOwnerDiscordUser(env, discordUserId);

  const link = await getActiveMinecraftLink(env.DB, discordUserId);
  if (!link) {
    throw new Response("Forbidden", { status: 403 });
  }

  const serverState = await getServerState(env.DB);
  const serverOnline = serverState
    ? isMcServerOnline(serverState.checkedAt, serverState.online)
    : false;
  if (!serverOnline) {
    return redirect("/?map=offline");
  }

  const origin = requireMcEnvValue(env, "SURVCORE_MAP_ORIGIN_URL").replace(/\/+$/, "");
  const targetUrl = new URL("/", `${origin}/`);
  targetUrl.search = incomingUrl.search;

  const proxiedRequest = new Request(targetUrl.toString(), request);
  proxiedRequest.headers.delete("Cookie");
  proxiedRequest.headers.delete("Authorization");
  proxiedRequest.headers.delete("Origin");
  proxiedRequest.headers.set(
    "CF-Access-Client-Id",
    requireMcEnvValue(env, "SURVCORE_MAP_ORIGIN_ACCESS_CLIENT_ID")
  );
  proxiedRequest.headers.set(
    "CF-Access-Client-Secret",
    requireMcEnvValue(env, "SURVCORE_MAP_ORIGIN_ACCESS_CLIENT_SECRET")
  );

  const response = await fetch(proxiedRequest, { redirect: "manual" });

  const nextHeaders = new Headers(response.headers);
  const location = nextHeaders.get("Location");
  if (location) {
    nextHeaders.set("Location", rewriteMapLocation(location, incomingUrl, origin));
  }
  nextHeaders.set("X-Map-Proxy-Origin-Status", String(response.status));
  nextHeaders.set(
    "X-Map-Proxy-Access-Domain",
    response.headers.get("cf-access-domain") ?? ""
  );
  nextHeaders.set(
    "X-Map-Proxy-Access-Aud",
    response.headers.get("cf-access-aud") ?? ""
  );
  nextHeaders.delete("set-cookie");
  nextHeaders.delete("content-security-policy");
  nextHeaders.delete("x-frame-options");
  nextHeaders.set("Cache-Control", "private, no-store");

  if (response.status >= 400) {
    console.error("Map proxy origin error", {
      path: incomingUrl.pathname + incomingUrl.search,
      targetUrl: targetUrl.toString(),
      status: response.status,
      location: response.headers.get("location"),
      cfAccessDomain: response.headers.get("cf-access-domain"),
      cfAccessAud: response.headers.get("cf-access-aud"),
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}
