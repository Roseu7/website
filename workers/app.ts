import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
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

function withSecurityHeaders(response: Response): Response {
  const nextHeaders = new Headers(response.headers);
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
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

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    // 通常のReact Routerリクエスト処理
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });
    return withSecurityHeaders(response);
  },
} satisfies ExportedHandler<Env>;
