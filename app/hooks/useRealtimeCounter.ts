import { useState, useEffect, useRef, useCallback } from "react";

interface CounterUpdate {
  type: "counter_update" | "user_joined" | "user_left" | "pong" | "error";
  value?: number;
  operation?: "increment" | "decrement" | "reset";
  amount?: number;
  sessionId?: string;
  totalConnections?: number;
  timestamp?: number;
  message?: string;
}

interface UseRealtimeCounterOptions {
  counterName?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useRealtimeCounter(options: UseRealtimeCounterOptions = {}) {
  const {
    counterName = "global",
    reconnectAttempts = 3, // 最大試行回数を減らす
    reconnectDelay = 2000  // 初期遅延を増やす
  } = options;

  const [count, setCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [totalConnections, setTotalConnections] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  /**
   * WebSocket接続の確立
   */
  const connect = useCallback(() => {
    if (connectionState === "connecting") {
      console.log("Already connecting, skipping...");
      return;
    }
    
    // 既存の接続があればクリーンアップ
    if (wsRef.current) {
      console.log("Cleaning up existing connection");
      wsRef.current.onclose = null; // イベントハンドラーを無効化
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
    
    // WebSocket URLを構築（開発/本番環境を自動判定）
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/realtime-counter?name=${encodeURIComponent(counterName)}`;
    
    console.log(`Attempting WebSocket connection ${reconnectAttemptsRef.current + 1}/${reconnectAttempts} to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setConnectionState("connected");
      reconnectAttemptsRef.current = 0;
      wsRef.current = ws;
      
      // ハートビート開始
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data: CounterUpdate = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
      setConnectionState("disconnected");
      wsRef.current = null;
      stopHeartbeat();
      
      // 手動切断（code 1000）や異常切断でない場合は再接続しない
      if (event.code === 1000 || event.code === 1001) {
        console.log("WebSocket closed normally, not reconnecting");
        return;
      }
      
      // 自動再接続（最大試行回数の制限）
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`Reconnecting attempt ${reconnectAttemptsRef.current + 1}/${reconnectAttempts} in ${delay}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        console.log("Maximum reconnection attempts reached");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

  }, [counterName, connectionState, reconnectAttempts, reconnectDelay]);

  /**
   * メッセージハンドリング
   */
  const handleMessage = useCallback((data: CounterUpdate) => {
    console.log("Received message:", data); // デバッグログ追加
    switch (data.type) {
      case "counter_update":
        if (data.value !== undefined) {
          setCount(data.value);
          setLastUpdate(data.timestamp || Date.now());
        }
        // counter_updateでもtotalConnectionsを処理
        if (data.totalConnections !== undefined) {
          setTotalConnections(data.totalConnections);
        }
        break;
      case "user_joined":
      case "user_left":
        if (data.totalConnections !== undefined) {
          setTotalConnections(data.totalConnections);
        }
        break;
      case "pong":
        // ハートビート応答（特に処理なし）
        break;
      case "error":
        console.error("Server error:", data.message);
        break;
      default:
        console.warn("Unknown message type:", data.type);
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
   * カウンター操作メソッド
   */
  const increment = useCallback((amount: number = 1) => {
    return sendMessage({ type: "increment", amount });
  }, [sendMessage]);

  const decrement = useCallback((amount: number = 1) => {
    return sendMessage({ type: "decrement", amount });
  }, [sendMessage]);

  const reset = useCallback(() => {
    return sendMessage({ type: "reset" });
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
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, [stopHeartbeat]);

  // 初期接続とクリーンアップ
  useEffect(() => {
    // カウンター名が変更された時は状態をリセット
    reconnectAttemptsRef.current = 0;
    setCount(0); // カウンター値をリセット
    setTotalConnections(0); // 接続者数をリセット
    setLastUpdate(Date.now()); // 最終更新時刻をリセット
    connect();
    
    return () => {
      disconnect();
    };
  }, [counterName]); // connect と disconnect の依存を削除

  return {
    // 状態
    count,
    isConnected,
    connectionState,
    totalConnections,
    lastUpdate,
    
    // 操作
    increment,
    decrement,
    reset,
    reconnect,
    disconnect,
    
    // WebSocket生状態（デバッグ用）
    ws: wsRef.current
  };
}