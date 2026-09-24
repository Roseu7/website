import { redirect } from "react-router";
import {
  MC_DASHBOARD_HOST,
  isCanonicalMcDashboardHost,
  isMcDashboardHost,
} from "~/utils/host-config";

export { isCanonicalMcDashboardHost, isMcDashboardHost };

const LOCAL_DEV_ORIGINS = new Set([
  "http://mc.localhost:4173",
  "http://mc.localhost:5173",
]);

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
    return origin === url.origin && url.protocol === "https:" && url.hostname === MC_DASHBOARD_HOST && url.port === "";
  } catch {
    return false;
  }
}

export function requireMcMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (isAllowedMcOrigin(origin)) return;
    throw new Response("Forbidden", { status: 403 });
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
