import { redirect } from "react-router";
import { MC_DASHBOARD_HOST } from "~/utils/host-config";
const LOCAL_DEV_HOSTS = new Set(["mc.localhost"]);
const LOCAL_DEV_ORIGINS = new Set([
  "http://mc.localhost:4173",
  "http://mc.localhost:5173",
]);

export function isMcDashboardHost(hostname: string) {
  return hostname === MC_DASHBOARD_HOST || LOCAL_DEV_HOSTS.has(hostname);
}

export function isCanonicalMcDashboardHost(hostname: string) {
  return hostname === MC_DASHBOARD_HOST;
}

export function requireMcDashboardHost(request: Request) {
  const { hostname } = new URL(request.url);
  if (!isMcDashboardHost(hostname)) {
    throw new Response("Not Found", { status: 404 });
  }
}

function isAllowedMcOrigin(origin: string): boolean {
  if (LOCAL_DEV_ORIGINS.has(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname === MC_DASHBOARD_HOST;
  } catch {
    return false;
  }
}

export function requireMcMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && isAllowedMcOrigin(origin)) {
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (isAllowedMcOrigin(refererUrl.origin)) {
        return;
      }
    } catch {
      // ignore invalid referer
    }
  }

  throw new Response("Forbidden", { status: 403 });
}

export function redirectMcDashboardSubpathToRoot(request: Request, pathname: string) {
  const url = new URL(request.url);
  if (isMcDashboardHost(url.hostname) && url.pathname === pathname) {
    throw redirect("/");
  }
}
