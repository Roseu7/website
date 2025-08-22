import { DurableObject } from "cloudflare:workers";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface UserSession {
  sessionId: string;
  username: string;
  joinTime: number;
}

/**
 * チャットルーム用Durable Object
 * WebSocket接続による リアルタイムチャット
 */
export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, UserSession>();
  private messages: ChatMessage[] = [];
  private messageHistory: ChatMessage[] = [];

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  private isInitialized = false;

  /**
   * ストレージからメッセージ履歴を初期化（遅延実行）
   */
  private async ensureInitialized() {
    if (!this.isInitialized) {
      const stored = await this.ctx.storage.get("messages");
      this.messageHistory = (stored as ChatMessage[]) || [];
      this.isInitialized = true;
      console.log(`Initialized chat room with ${this.messageHistory.length} messages`);
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
    const username = url.searchParams.get("username") || `User${Math.floor(Math.random() * 1000)}`;
    const sessionInfo: UserSession = {
      sessionId,
      username,
      joinTime: Date.now()
    };
    
    server.serializeAttachment(sessionInfo);

    // サーバー側WebSocketを受け入れ（Hibernation対応）
    this.ctx.acceptWebSocket(server);

    // セッション管理Mapに追加
    this.sessions.set(server, sessionInfo);
    
    console.log(`New chat connection: ${username} (${sessionId}), total: ${this.sessions.size}`);
    
    // 接続時にメッセージ履歴を送信
    server.send(JSON.stringify({
      type: "message_history",
      messages: this.messageHistory.slice(-50), // 直近50件
      sessionId,
      timestamp: Date.now()
    }));

    // 接続者数を送信
    server.send(JSON.stringify({
      type: "user_count",
      count: this.sessions.size,
      sessionId,
      timestamp: Date.now()
    }));

    // 他のセッションに新規参加を通知
    this.broadcastToOthers(server, {
      type: "user_joined",
      username,
      sessionId,
      userCount: this.sessions.size,
      timestamp: Date.now()
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
      const attachment = ws.deserializeAttachment() as UserSession;
      
      switch (data.type) {
        case "chat_message":
          await this.handleChatMessage(ws, data.message, attachment);
          break;
        case "typing_start":
          this.handleTypingStart(ws, attachment);
          break;
        case "typing_stop":
          this.handleTypingStop(ws, attachment);
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
      console.log(`Chat user disconnected: ${sessionInfo.username} (${sessionInfo.sessionId}), total: ${this.sessions.size}`);
      
      // 他のセッションに離脱を通知
      this.broadcastToAll({
        type: "user_left",
        username: sessionInfo.username,
        sessionId: sessionInfo.sessionId,
        userCount: this.sessions.size,
        timestamp: Date.now()
      });
    }
  }

  /**
   * チャットメッセージ処理
   */
  private async handleChatMessage(ws: WebSocket, messageText: string, userSession: UserSession) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      userId: userSession.sessionId,
      username: userSession.username,
      message: messageText.slice(0, 500), // 最大500文字
      timestamp: Date.now()
    };

    // メッセージ履歴に追加
    this.messageHistory.push(message);
    
    // 最大1000件まで保持
    if (this.messageHistory.length > 1000) {
      this.messageHistory = this.messageHistory.slice(-1000);
    }

    // ストレージに保存
    await this.ctx.storage.put("messages", this.messageHistory);

    // 全セッションにブロードキャスト
    this.broadcastToAll({
      type: "new_message",
      message,
      timestamp: Date.now()
    });
  }

  /**
   * タイピング開始処理
   */
  private handleTypingStart(ws: WebSocket, userSession: UserSession) {
    this.broadcastToOthers(ws, {
      type: "typing_start",
      username: userSession.username,
      sessionId: userSession.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * タイピング停止処理
   */
  private handleTypingStop(ws: WebSocket, userSession: UserSession) {
    this.broadcastToOthers(ws, {
      type: "typing_stop",
      username: userSession.username,
      sessionId: userSession.sessionId,
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
   * チャットルーム統計情報
   */
  async getRoomStats() {
    await this.ensureInitialized();
    return {
      activeUsers: this.sessions.size,
      totalMessages: this.messageHistory.length,
      lastActivity: this.messageHistory.length > 0 
        ? this.messageHistory[this.messageHistory.length - 1].timestamp 
        : Date.now()
    };
  }
}