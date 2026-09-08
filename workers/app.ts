import { createRequestHandler } from "react-router";
import { withSecurityHeaders } from "./security-headers";

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
