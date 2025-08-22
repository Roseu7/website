import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useRealtimeCounter } from "~/hooks/useRealtimeCounter";

export default function RealtimeCounterTest() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [counterName, setCounterName] = useState("global");
  
  // 初回マウント時にURLパラメータから初期値を設定
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlCounterName = searchParams.get("name");
      if (urlCounterName) {
        setCounterName(urlCounterName);
      }
    }
  }, []); // 初回のみ実行

  // URLパラメータの変更を監視（ナビゲーション時）
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlCounterName = searchParams.get("name");
      if (urlCounterName && urlCounterName !== counterName) {
        setCounterName(urlCounterName);
      } else if (!urlCounterName && counterName !== "global") {
        setCounterName("global");
      }
    }
  }, [searchParams]);
  
  const {
    count,
    isConnected,
    connectionState,
    totalConnections,
    lastUpdate,
    increment,
    decrement,
    reset,
    reconnect
  } = useRealtimeCounter({ counterName });

  const handleCounterNameChange = (newName: string) => {
    setCounterName(newName);
    // URLパラメータを更新（ページリロードなし）
    setSearchParams({ name: newName });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <style dangerouslySetInnerHTML={{
        __html: `
          .counter-display {
            font-size: 5rem;
            font-weight: 800;
            background: linear-gradient(45deg, #10b981, #3b82f6, #8b5cf6, #10b981, #3b82f6);
            background-size: 300% 300%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            animation: gradientShift 4s ease-in-out infinite;
            will-change: background-position;
            transform: translateZ(0); /* GPU加速化 */
          }
          
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .connection-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
          }
          
          .connected { background-color: #10b981; animation: pulse 2s infinite; }
          .connecting { background-color: #f59e0b; animation: blink 1s infinite; }
          .disconnected { background-color: #ef4444; }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
          
          .realtime-button {
            transition: transform 0.2s ease;
            transform: scale(1) translateZ(0);
            will-change: transform;
          }
          
          .realtime-button:hover {
            transform: scale(1.05) translateZ(0);
          }
          
          .realtime-button:active {
            transform: scale(0.95) translateZ(0);
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
          }
        `
      }} />

      <header className="fixed top-0 left-0 w-full p-4 sm:p-6 z-40 bg-white/80 dark:bg-gray-900/80 shadow-md backdrop-blur-sm">
        <div className="container mx-auto flex justify-between items-center relative h-10">
          <a 
            href="/" 
            className="text-lg font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            ← Home
          </a>
          <a 
            href="/counter-test" 
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Basic Counter
          </a>
        </div>
      </header>

      <main className="pt-32 pb-20">
        <div className="container mx-auto p-8 min-h-screen">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white text-center mb-2 font-light">
            🚀 Realtime Counter
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
            WebSocket + Durable Objects によるリアルタイム同期カウンター
          </p>
          
          {/* 接続状態表示 */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-center mb-4">
                <span 
                  className={`connection-indicator ${connectionState}`}
                ></span>
                <span className="text-sm font-medium">
                  {connectionState === "connected" && "🟢 リアルタイム接続中"}
                  {connectionState === "connecting" && "🟡 接続中..."}
                  {connectionState === "disconnected" && "🔴 切断中"}
                </span>
              </div>
              
              <div className="stats-grid text-center text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <div className="font-semibold">接続者数</div>
                  <div className="text-lg">{totalConnections}</div>
                </div>
                <div>
                  <div className="font-semibold">カウンター</div>
                  <div className="text-lg font-mono">{counterName}</div>
                </div>
                <div>
                  <div className="font-semibold">最終更新</div>
                  <div className="text-lg">{new Date(lastUpdate).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* メインカウンター */}
          <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 mb-8">
            <div className="text-center mb-8">
              <div className="counter-display mb-4">
                {count}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                他の人がボタンを押すとリアルタイムで更新されます
              </p>
            </div>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => decrement()}
                disabled={!isConnected}
                className="realtime-button flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-lg text-2xl"
              >
                −
              </button>
              
              <button
                onClick={() => increment()}
                disabled={!isConnected}
                className="realtime-button flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl shadow-lg text-2xl"
              >
                +
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => reset()}
                disabled={!isConnected}
                className="realtime-button flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg text-sm"
              >
                リセット
              </button>
              
              <button
                onClick={() => reconnect()}
                className="realtime-button flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm"
              >
                再接続
              </button>
            </div>
          </div>

          {/* カウンター選択 */}
          <div className="max-w-lg mx-auto bg-gray-50 dark:bg-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
              カウンターを選択
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {["global", "test", "demo", "public"].map((name) => (
                <button
                  key={name}
                  onClick={() => handleCounterNameChange(name)}
                  className={`p-3 rounded-lg font-medium transition-all ${
                    counterName === name
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            
            <div className="mt-4">
              <input
                type="text"
                placeholder="カスタム名を入力..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      handleCounterNameChange(value);
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* 説明 */}
          <div className="max-w-2xl mx-auto mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              🎯 リアルタイム機能テスト方法
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <li>• 複数のタブでこのページを開く</li>
              <li>• 片方のタブでボタンをクリック</li>
              <li>• 他のタブでリアルタイムに更新される様子を確認</li>
              <li>• 異なるカウンター名で独立したインスタンスをテスト</li>
              <li>• 接続状態と接続者数の変化を観察</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; 2025 Roseu. All Rights Reserved.</p>
          <p className="mt-1 text-xs">
            Powered by Cloudflare Durable Objects + WebSocket Hibernation
          </p>
        </div>
      </footer>
    </div>
  );
}