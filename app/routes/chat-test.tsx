import { useState, useEffect, useRef } from "react";
import { useChat } from "~/hooks/useChat";

export default function ChatTest() {
  const [roomName, setRoomName] = useState("general");
  const [username, setUsername] = useState(() => `User${Math.floor(Math.random() * 1000)}`);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const {
    messages,
    isConnected,
    connectionState,
    userCount,
    typingUsers,
    sendChatMessage,
    startTyping,
    stopTyping,
    reconnect
  } = useChat({ roomName, username });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // メッセージ送信
  const handleSendMessage = () => {
    if (messageInput.trim() && isConnected) {
      sendChatMessage(messageInput);
      setMessageInput("");
      if (isTyping) {
        stopTyping();
        setIsTyping(false);
      }
    }
  };

  // タイピング処理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      startTyping();
    }
    
    // 3秒間タイピングが停止したらタイピング状態を解除
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        stopTyping();
      }
    }, 3000);
  };

  // Enterキーでメッセージ送信
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // メッセージリストの自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <header className="fixed top-0 left-0 w-full p-4 sm:p-6 z-40 bg-white/80 dark:bg-gray-900/80 shadow-md backdrop-blur-sm">
        <div className="container mx-auto flex justify-between items-center relative h-10">
          <a 
            href="/" 
            className="text-lg font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            ← Home
          </a>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Real-time Chat
          </span>
        </div>
      </header>

      <main className="pt-32 pb-20">
        <div className="container mx-auto p-8 min-h-screen">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white text-center mb-2 font-light">
            💬 Chat Test
          </h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
            チャット機能のテストページ
          </p>
          
          {/* チャット画面エリア */}
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
            
            {/* チャットヘッダー */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-2xl">
              <h2 className="text-xl font-semibold text-center">Chat Room: {roomName}</h2>
              <p className="text-sm text-center opacity-90">
                {isConnected ? `${userCount} users online` : "Connecting..."}
              </p>
            </div>
            
            {/* チャットメッセージエリア */}
            <div className="p-4 h-96 overflow-y-auto bg-gray-50 dark:bg-gray-700">
              <div className="space-y-4">
                
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                    <p>まだメッセージがありません</p>
                    <p className="text-sm">最初のメッセージを送信しましょう！</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id}>
                      {message.userId === "system" ? (
                        <div className="text-center">
                          <span className="inline-block bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-xs">
                            {message.message}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex ${message.username === username ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-2xl px-4 py-2 max-w-xs ${
                            message.username === username 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-white dark:bg-gray-600 shadow-sm'
                          }`}>
                            <p className="text-sm">{message.message}</p>
                            <span className={`text-xs ${
                              message.username === username 
                                ? 'text-blue-100' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {message.username === username ? 'あなた' : message.username}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {/* タイピングインジケーター */}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 dark:bg-gray-600 rounded-2xl px-4 py-2">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {typingUsers.join(', ')} が入力中...
                      </p>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* メッセージ入力エリア */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-600 rounded-b-2xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isConnected ? "メッセージを入力..." : "接続中..."}
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                  disabled={!isConnected}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full font-medium transition-colors"
                  disabled={!isConnected || !messageInput.trim()}
                >
                  送信
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                {isConnected ? "Enterキーでも送信できます" : "WebSocketに接続中..."}
              </p>
            </div>
          </div>
          
          {/* 接続状態表示 */}
          <div className="max-w-2xl mx-auto mt-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-center mb-4">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  connectionState === "connected" ? "bg-green-500" :
                  connectionState === "connecting" ? "bg-yellow-500" : "bg-red-500"
                }`}></span>
                <span className="text-sm font-medium">
                  {connectionState === "connected" && "🟢 接続中"}
                  {connectionState === "connecting" && "🟡 接続中..."}
                  {connectionState === "disconnected" && "🔴 未接続"}
                </span>
                {connectionState === "disconnected" && (
                  <button
                    onClick={reconnect}
                    className="ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                  >
                    再接続
                  </button>
                )}
              </div>
              <div className="text-center text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>WebSocket接続: {isConnected ? "正常" : "切断中"}</p>
                <p>参加者数: {userCount}人</p>
                <p>チャットルーム: {roomName}</p>
                <p>ユーザー名: {username}</p>
              </div>
            </div>
          </div>
          
          {/* 説明エリア */}
          <div className="max-w-2xl mx-auto mt-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
              ✅ 実装済み機能
            </h4>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-2">
              <li>• WebSocket接続による リアルタイムチャット</li>
              <li>• Durable Objects を使った チャットルーム管理</li>
              <li>• 複数ユーザーでの同時チャット</li>
              <li>• メッセージ履歴の保存・表示</li>
              <li>• ユーザー参加・離脱の通知</li>
              <li>• タイピングインジケーター</li>
              <li>• 自動再接続機能</li>
              <li>• WebSocket Hibernation対応</li>
            </ul>
          </div>
          
          {/* テスト方法 */}
          <div className="max-w-2xl mx-auto mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
              🧪 テスト方法
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <li>• 複数のタブでこのページを開く</li>
              <li>• 片方のタブでメッセージを送信</li>
              <li>• 他のタブでリアルタイムに受信される様子を確認</li>
              <li>• 入力中は「入力中...」表示が他のユーザーに見える</li>
              <li>• ユーザーの参加・離脱がリアルタイムで通知される</li>
            </ul>
          </div>
          
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; 2025 Roseu. All Rights Reserved.</p>
          <p className="mt-1 text-xs">
            Chat Test Page - WebSocket機能テスト用
          </p>
        </div>
      </footer>
    </div>
  );
}