import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";

interface CounterData {
  count: number;
  counterName: string;
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const counterName = url.searchParams.get("name") || "global";
  
  try {
    // Durable Object インスタンスを取得
    const id = context.cloudflare.env.COUNTERS.idFromName(counterName);
    const stub = context.cloudflare.env.COUNTERS.get(id);
    
    // カウンター値を取得
    const count = await stub.getCounterValue();
    
    return { count, counterName };
  } catch (error) {
    console.error("Counter fetch error:", error);
    return { count: 0, counterName };
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const counterName = formData.get("counterName") as string || "global";
  
  try {
    // Durable Object インスタンスを取得
    const id = context.cloudflare.env.COUNTERS.idFromName(counterName);
    const stub = context.cloudflare.env.COUNTERS.get(id);
    
    let count: number;
    
    switch (action) {
      case "increment":
        count = await stub.increment();
        break;
      case "decrement":
        count = await stub.decrement();
        break;
      default:
        count = await stub.getCounterValue();
    }
    
    return { count, counterName };
  } catch (error) {
    console.error("Counter action error:", error);
    throw new Response("Counter Error", { status: 500 });
  }
}

export default function CounterTest() {
  const { count: initialCount, counterName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  
  // 現在のカウント値（アクション結果で更新）
  const currentCount = fetcher.data?.count ?? initialCount;
  
  // ローディング状態
  const isLoading = fetcher.state !== "idle";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <style dangerouslySetInnerHTML={{
        __html: `
          .counter-display {
            font-size: 4rem;
            font-weight: 800;
            background: linear-gradient(45deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .counter-button {
            transition: all 0.2s ease;
            transform: scale(1);
          }
          
          .counter-button:hover {
            transform: scale(1.05);
          }
          
          .counter-button:active {
            transform: scale(0.95);
          }
          
          .counter-button:disabled {
            opacity: 0.6;
            transform: scale(1);
            cursor: not-allowed;
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
        </div>
      </header>

      <main className="pt-32 pb-20">
        <div className="container mx-auto p-8 min-h-screen">
          <h3 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-2 font-light">
            Durable Object Counter Test
          </h3>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12">
            永続クリックカウンター - Cloudflare Durable Objects実装
          </p>
          
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Counter: <span className="font-mono font-semibold">{counterName}</span>
              </p>
              <div className="counter-display">
                {currentCount}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                このカウンターは永続的に保存されます
              </p>
            </div>
            
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="counterName" value={counterName} />
              
              <div className="flex gap-4">
                <button
                  type="submit"
                  name="action"
                  value="decrement"
                  disabled={isLoading}
                  className="counter-button flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-3 px-6 rounded-lg shadow-md"
                >
                  {isLoading ? "..." : "−"}
                </button>
                
                <button
                  type="submit"
                  name="action"
                  value="increment"
                  disabled={isLoading}
                  className="counter-button flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 px-6 rounded-lg shadow-md"
                >
                  {isLoading ? "..." : "+"}
                </button>
              </div>
            </fetcher.Form>
            
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 font-light">
                テスト機能:
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• 永続化されたカウンター状態</li>
                <li>• Durable Objects による実装</li>
                <li>• React Router v7 統合</li>
                <li>• リアルタイム状態更新</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              異なるカウンター: 
              <a href="?name=test-counter" className="text-blue-500 hover:text-blue-600 underline ml-1">test-counter</a> | 
              <a href="?name=global" className="text-blue-500 hover:text-blue-600 underline ml-2">global</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; 2025 Roseu. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}