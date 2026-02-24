import * as React from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { LinksFunction } from "react-router";

import "./styles/app.css";

export const links: LinksFunction = () => [
  {
    rel: "preload",
    href: "/fonts/Poppins/Poppins-ExtraBold.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/EncodeSansSC/EncodeSansSC-Thin.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/NotoSansJP/NotoSansJP-Regular.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <DarkModeScript />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const LOADER_MIN_MS = 400;
              const LOADER_MAX_WAIT_MS = 8000;
              const startedAt = Date.now();

              function hideLoader() {
                const loader = document.getElementById('app-loader');
                if (!loader || loader.classList.contains('hidden')) return;

                const elapsed = Date.now() - startedAt;
                const remaining = Math.max(0, LOADER_MIN_MS - elapsed);

                window.setTimeout(() => {
                  loader.classList.add('hidden');
                }, remaining);
              }

              // 読み込み完了でローダーを閉じる
              window.addEventListener('load', hideLoader, { once: true });
              // フォールバック
              window.setTimeout(hideLoader, LOADER_MAX_WAIT_MS);
            })();
          `
        }} />
      </head>
      <body className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 theme-transition">
        <div id="app-loader" className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="loader-dot"></div>
        </div>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// 初期テーマ適用
function DarkModeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            if (localStorage.getItem('theme') === 'dark' ||
                (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          })();
        `,
      }}
    />
  );
}

export default function App() {
  return <Outlet />;
}
