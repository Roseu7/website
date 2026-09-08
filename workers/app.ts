import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cspNonce: string;
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

function isMapRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.hostname === "mc.roseu.net" && (url.pathname === "/map" || url.pathname.startsWith("/map/"));
}

function withSecurityHeaders(request: Request, response: Response, nonce: string): Response {
  const nextHeaders = new Headers(response.headers);
  const scriptSrc = isMapRequest(request)
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}'`;
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

export default {
  async fetch(request, env, ctx) {
    const cspNonce = crypto.randomUUID().replaceAll("-", "");
    // 通常のReact Routerリクエスト処理
    const response = await requestHandler(request, {
      cspNonce,
      cloudflare: { env, ctx },
    });
    return withSecurityHeaders(request, response, cspNonce);
  },
} satisfies ExportedHandler<Env>;
