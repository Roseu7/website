import { createRequestHandler } from "react-router";

// Durable Objectsをエクスポート
export { Counter } from "./durable-objects/counter";
export { RealtimeCounter } from "./durable-objects/realtime-counter";
export { ChatRoom } from "./durable-objects/chat-room";

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // WebSocketエンドポイントの処理
    if (url.pathname.startsWith('/ws/realtime-counter')) {
      // WebSocketリクエストかどうか確認
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      
      // カウンター名を取得（デフォルト: "global"）
      const counterName = url.searchParams.get("name") || "global";
      
      // Durable Objectインスタンスを取得
      const id = env.REALTIME_COUNTERS.idFromName(counterName);
      const stub = env.REALTIME_COUNTERS.get(id);
      
      // WebSocket接続をDurable Objectに転送
      return stub.fetch(request);
    }

    // チャットWebSocketエンドポイントの処理
    if (url.pathname.startsWith('/ws/chat')) {
      // WebSocketリクエストかどうか確認
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      
      // チャットルーム名を取得（デフォルト: "general"）
      const roomName = url.searchParams.get("room") || "general";
      
      // Durable Objectインスタンスを取得
      const id = env.CHAT_ROOMS.idFromName(roomName);
      const stub = env.CHAT_ROOMS.get(id);
      
      // WebSocket接続をDurable Objectに転送
      return stub.fetch(request);
    }
    
    // 通常のReact Routerリクエスト処理
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
