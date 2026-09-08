function isMapRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.hostname === "mc.roseu.net" && (url.pathname === "/map" || url.pathname.startsWith("/map/"));
}

export function withSecurityHeaders(request: Request, response: Response, nonce: string): Response {
  const nextHeaders = new Headers(response.headers);
  // BlueMap's translation compiler uses new Function. Keep this exception
  // only on successfully proxied map documents, never on auth/error pages.
  const isMapDocument = isMapRequest(request)
    && response.status === 200
    && nextHeaders.get("X-Map-Proxy-Origin-Status") === "200"
    && /^text\/html(?:;|$)/i.test(nextHeaders.get("Content-Type") ?? "");
  const scriptSrc = `script-src 'self' 'nonce-${nonce}'${isMapDocument ? " 'unsafe-eval'" : ""}`;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://home.roseu.net https://roseu.net https://www.roseu.net ws: wss:",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  nextHeaders.set("X-Content-Type-Options", "nosniff");
  nextHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  nextHeaders.set("X-Frame-Options", "DENY");
  nextHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  nextHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  nextHeaders.set("Content-Security-Policy", csp);
  if (nextHeaders.get("Content-Type")?.includes("text/html")) {
    nextHeaders.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}
