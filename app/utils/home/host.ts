import { redirect } from "react-router";
import { HOME_CONTROL_HOST } from "~/utils/host-config";
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_DEV_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function isHomeControlHost(hostname: string) {
  return hostname === HOME_CONTROL_HOST || LOCAL_DEV_HOSTS.has(hostname);
}

export function requireHomeControlHost(request: Request) {
  const { hostname } = new URL(request.url);
  if (!isHomeControlHost(hostname)) {
    throw new Response("Not Found", { status: 404 });
  }
}

export function redirectHomeControlSubpathToRoot(request: Request) {
  const url = new URL(request.url);
  if (isHomeControlHost(url.hostname) && url.pathname === "/home-control") {
    throw redirect("/");
  }
}

export function isCanonicalHomeControlHost(hostname: string) {
  return hostname === HOME_CONTROL_HOST;
}

function isAllowedHomeOrigin(origin: string): boolean {
  if (LOCAL_DEV_ORIGINS.has(origin)) {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname === HOME_CONTROL_HOST;
  } catch {
    return false;
  }
}

export function requireHomeMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && isAllowedHomeOrigin(origin)) {
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (isAllowedHomeOrigin(refererUrl.origin)) {
        return;
      }
    } catch {
      // invalid referer -> reject below
    }
  }

  throw new Response("Forbidden", { status: 403 });
}
