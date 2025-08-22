import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface ChatUpdate {
  type: "new_message" | "user_joined" | "user_left" | "typing_start" | "typing_stop" | "user_count" | "message_history" | "pong" | "error";
  message?: ChatMessage;
  messages?: ChatMessage[];
  username?: string;
  sessionId?: string;
  userCount?: number;
  count?: number;
  timestamp?: number;
  error?: string;
}

interface UseChatOptions {
  roomName?: string;
  username?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useChat(options: UseChatOptions = {}) {
  const {
    roomName = "general",
    username = `User${Math.floor(Math.random() * 1000)}`,
    reconnectAttempts = 3,
    reconnectDelay = 2000
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [userCount, setUserCount] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  /**
   * WebSocket接続の確立
   */
  const connect = useCallback(() => {
    if (connectionState === "connecting") {
      console.log("Already connecting to chat, skipping...");
      return;
    }
    
    // 既存の接続があればクリーンアップ
    if (wsRef.current) {
      console.log("Cleaning up existing chat connection");
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // 既存のタイムアウトをクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState("connecting");
    
    // WebSocket URLを構築
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/chat?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`;
    
    console.log(`Attempting chat WebSocket connection ${reconnectAttemptsRef.current + 1}/${reconnectAttempts} to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Chat WebSocket connected");
      setIsConnected(true);
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      wsRef.current = ws;
      
      // ハートビート開始
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data: ChatUpdate = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error("Chat WebSocket message parse error:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("Chat WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
      setConnectionState("disconnected");
      wsRef.current = null;
      stopHeartbeat();
      
      // 手動切断時は再接続しない
      if (event.code === 1000 || event.code === 1001) {
        console.log("Chat WebSocket closed normally, not reconnecting");
        return;
      }
      
      // 自動再接続（最大試行回数の制限）
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`Reconnecting to chat attempt ${reconnectAttemptsRef.current + 1}/${reconnectAttempts} in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.log("Maximum chat reconnection attempts reached");
      }
    };

    ws.onerror = (error) => {
      console.error("Chat WebSocket error:", error);
    };

  }, [roomName, username, connectionState, reconnectAttempts, reconnectDelay]);

  /**
   * メッセージハンドリング
   */
  const handleMessage = useCallback((data: ChatUpdate) => {
    console.log("Chat received message:", data);
    switch (data.type) {
      case "new_message":
        if (data.message) {
          setMessages(prev => [...prev, data.message!]);
        }
        break;
      case "message_history":
        if (data.messages) {
          setMessages(data.messages);
        }
        break;
      case "user_joined":
        if (data.username) {
          // システムメッセージとして追加
          const systemMessage: ChatMessage = {
            id: crypto.randomUUID(),
            userId: "system",
            username: "System",
            message: `${data.username} が参加しました`,
            timestamp: data.timestamp || Date.now()
          };
          setMessages(prev => [...prev, systemMessage]);
        }
        if (data.userCount !== undefined) {
          setUserCount(data.userCount);
        }
        break;
      case "user_left":
        if (data.username) {
          // システムメッセージとして追加
          const systemMessage: ChatMessage = {
            id: crypto.randomUUID(),
            userId: "system",
            username: "System",
            message: `${data.username} が退出しました`,
            timestamp: data.timestamp || Date.now()
          };
          setMessages(prev => [...prev, systemMessage]);
        }
        if (data.userCount !== undefined) {
          setUserCount(data.userCount);
        }
        break;
      case "user_count":
        if (data.count !== undefined) {
          setUserCount(data.count);
        }
        break;
      case "typing_start":
        if (data.username) {
          setTypingUsers(prev => new Set([...prev, data.username!]));
        }
        break;
      case "typing_stop":
        if (data.username) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.username!);
            return newSet;
          });
        }
        break;
      case "pong":
        // ハートビート応答（特に処理なし）
        break;
      case "error":
        console.error("Chat server error:", data.error);
        break;
      default:
        console.warn("Unknown chat message type:", data.type);
    }
  }, []);

  /**
   * ハートビート開始
   */
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // 30秒間隔
  }, []);

  /**
   * ハートビート停止
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * WebSocketメッセージ送信
   */
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  /**
   * チャットメッセージ送信
   */
  const sendChatMessage = useCallback((messageText: string) => {
    if (messageText.trim()) {
      return sendMessage({ type: "chat_message", message: messageText.trim() });
    }
    return false;
  }, [sendMessage]);

  /**
   * タイピング開始通知
   */
  const startTyping = useCallback(() => {
    sendMessage({ type: "typing_start" });
    
    // 3秒後に自動的にタイピング停止
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [sendMessage]);

  /**
   * タイピング停止通知
   */
  const stopTyping = useCallback(() => {
    sendMessage({ type: "typing_stop" });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [sendMessage]);

  /**
   * 手動再接続
   */
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  /**
   * 接続切断
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, [stopHeartbeat]);

  // 初期接続とクリーンアップ
  useEffect(() => {
    if (typeof window !== "undefined") {
      // ルーム名やユーザー名が変更された時は状態をリセット
      reconnectAttemptsRef.current = 0;
      setMessages([]);
      setUserCount(0);
      setTypingUsers(new Set());
      connect();
      
      return () => {
        disconnect();
      };
    }
  }, [roomName, username]);

  return {
    // 状態
    messages,
    isConnected,
    connectionState,
    userCount,
    typingUsers: Array.from(typingUsers),
    
    // 操作
    sendChatMessage,
    startTyping,
    stopTyping,
    reconnect,
    disconnect,
    
    // WebSocket生状態（デバッグ用）
    ws: wsRef.current
  };
}