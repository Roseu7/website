export function isSameOriginRequest(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");

  if (origin !== null) {
    try {
      const parsedOrigin = new URL(origin);
      return origin === parsedOrigin.origin && parsedOrigin.origin === requestOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("Referer");
  if (referer !== null) {
    try {
      return new URL(referer).origin === requestOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

export function requireSameOriginRequest(request: Request) {
  if (!isSameOriginRequest(request)) {
    throw new Response("Forbidden", { status: 403 });
  }
}
