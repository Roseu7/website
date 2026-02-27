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
  nextHeaders.set("X-Content-Type-Options", "nosniff");
  nextHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  nextHeaders.set("X-Frame-Options", "DENY");
  nextHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  nextHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

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
