import { DurableObject } from "cloudflare:workers";

/**
 * リアルタイムカウンター用Durable Object
 * WebSocket接続による即座の状態同期
 */
export class RealtimeCounter extends DurableObject {
  private sessions = new Map<WebSocket, { sessionId: string; joinTime: number }>();
  private currentValue = 0;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    // 非同期初期化は必要な時に実行
  }

  private isInitialized = false;

  /**
   * ストレージからカウンター値を初期化（遅延実行）
   */
  private async ensureInitialized() {
    if (!this.isInitialized) {
      const stored = await this.ctx.storage.get("value");
      this.currentValue = (stored as number) || 0;
      this.isInitialized = true;
      console.log(`Initialized counter value: ${this.currentValue}`);
    }
  }

  /**
   * WebSocket接続の処理
   */
  async fetch(request: Request) {
    // 初期化を確実に実行
    await this.ensureInitialized();
    
    const url = new URL(request.url);
    
    // WebSocket接続のアップグレード確認
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    // WebSocketペアを作成
    const [client, server] = Object.values(new WebSocketPair());
    
    // セッション情報をアタッチメントに保存
    const sessionId = crypto.randomUUID();
    const sessionInfo = {
      sessionId,
      joinTime: Date.now(),
      counterName: url.searchParams.get("name") || "global"
    };
    
    server.serializeAttachment(sessionInfo);

    // サーバー側WebSocketを受け入れ（Hibernation対応）
    this.ctx.acceptWebSocket(server);

    // セッション管理Mapに追加
    this.sessions.set(server, { sessionId, joinTime: Date.now() });
    
    console.log(`New WebSocket connection: ${sessionId}, total: ${this.sessions.size}`);
    
    // 接続時に現在の値と接続者数を送信
    server.send(JSON.stringify({
      type: "counter_update",
      value: this.currentValue,
      sessionId,
      totalConnections: this.sessions.size,
      timestamp: Date.now()
    }));

    // 他のセッションに新規接続を通知
    this.broadcastToOthers(server, {
      type: "user_joined",
      sessionId,
      totalConnections: this.sessions.size
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * WebSocketメッセージ受信時の処理
   */
  async webSocketMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      const attachment = ws.deserializeAttachment();
      
      switch (data.type) {
        case "increment":
          await this.handleIncrement(data.amount || 1);
          break;
        case "decrement":
          await this.handleDecrement(data.amount || 1);
          break;
        case "reset":
          await this.handleReset();
          break;
        case "ping":
          // ハートビート応答
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        default:
          console.warn("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
    }
  }

  /**
   * WebSocket接続切断時の処理
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const sessionInfo = this.sessions.get(ws);
    this.sessions.delete(ws);
    
    if (sessionInfo) {
      console.log(`WebSocket disconnected: ${sessionInfo.sessionId}, total: ${this.sessions.size}`);
      
      // 他のセッションに切断を通知
      this.broadcastToAll({
        type: "user_left",
        sessionId: sessionInfo.sessionId,
        totalConnections: this.sessions.size
      });
    }
  }

  /**
   * カウンター増加処理
   */
  private async handleIncrement(amount: number = 1) {
    await this.ensureInitialized();
    this.currentValue += amount;
    await this.ctx.storage.put("value", this.currentValue);
    await this.updateTimestamp();
    
    this.broadcastToAll({
      type: "counter_update",
      value: this.currentValue,
      operation: "increment",
      amount,
      timestamp: Date.now()
    });
  }

  /**
   * カウンター減少処理
   */
  private async handleDecrement(amount: number = 1) {
    await this.ensureInitialized();
    this.currentValue -= amount;
    await this.ctx.storage.put("value", this.currentValue);
    await this.updateTimestamp();
    
    this.broadcastToAll({
      type: "counter_update",
      value: this.currentValue,
      operation: "decrement",
      amount,
      timestamp: Date.now()
    });
  }

  /**
   * カウンターリセット処理
   */
  private async handleReset() {
    await this.ensureInitialized();
    this.currentValue = 0;
    await this.ctx.storage.put("value", 0);
    await this.updateTimestamp();
    
    this.broadcastToAll({
      type: "counter_update",
      value: this.currentValue,
      operation: "reset",
      timestamp: Date.now()
    });
  }

  /**
   * 全セッションにメッセージをブロードキャスト
   */
  private broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((_, ws) => {
      try {
        ws.send(messageStr);
      } catch (error) {
        console.error("Broadcast error:", error);
        this.sessions.delete(ws);
      }
    });
  }

  /**
   * 特定のセッション以外にメッセージをブロードキャスト
   */
  private broadcastToOthers(sender: WebSocket, message: any) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((_, ws) => {
      if (ws !== sender) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error("Broadcast error:", error);
          this.sessions.delete(ws);
        }
      }
    });
  }

  /**
   * タイムスタンプ更新
   */
  private async updateTimestamp() {
    await this.ctx.storage.put("lastUpdated", Date.now());
  }

  /**
   * RPC APIメソッド（従来のHTTPアクセス用）
   */
  async getCounterValue(): Promise<number> {
    return this.currentValue;
  }

  async increment(amount: number = 1): Promise<number> {
    await this.handleIncrement(amount);
    return this.currentValue;
  }

  async decrement(amount: number = 1): Promise<number> {
    await this.handleDecrement(amount);
    return this.currentValue;
  }

  /**
   * 接続統計情報
   */
  async getConnectionStats() {
    return {
      activeConnections: this.sessions.size,
      currentValue: this.currentValue,
      lastUpdated: await this.ctx.storage.get("lastUpdated")
    };
  }
}