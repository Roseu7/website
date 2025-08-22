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
            function hideLoader() {
              const loader = document.getElementById('loader');
              if (loader && !loader.classList.contains('hidden')) {
                loader.classList.add('hidden');
              }
            }
            
            // 初回ロード時
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', hideLoader);
            } else {
              hideLoader();
            }
            
            // SPAナビゲーション時
            window.addEventListener('load', hideLoader);
            
            // React Router ナビゲーション完了後にもローダーを隠す
            setTimeout(hideLoader, 100);
          `
        }} />
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --theme-transition-duration: 0.5s;
            }

            html {
              scroll-behavior: smooth;
            }

            body {
              margin: 0;
            }

            body::-webkit-scrollbar {
              display: none;
            }

            #main-title-text,
            #main-subtitle-text {
              font-family: 'Poppins', sans-serif;
            }

            h3 {
              font-family: 'Encode Sans SC', sans-serif;
              font-weight: 100;
            }

            h4 {
              font-family: 'Noto Sans JP', sans-serif;
              font-weight: 400;
            }

            h5 {
              font-family: 'Noto Sans JP', sans-serif;
              font-weight: 100;
            }
            


            /* --- Transitions --- */
            body,
            hr,
            .knockout-text,
            #theme-toggle-btn,
            .tech-tag,
            #content-area h3,
            #content-area h4,
            #content-area h5,
            #content-area p,
            #content-area a,
            #content-area svg,
            footer p,
            .profile-image-wrapper {
              transition:
                color var(--theme-transition-duration) ease,
                background-color var(--theme-transition-duration) ease,
                border-color var(--theme-transition-duration) ease,
                text-shadow var(--theme-transition-duration) ease,
                fill var(--theme-transition-duration) ease;
            }

            .project-image-container {
              transition:
                transform 0.3s ease,
                background-color var(--theme-transition-duration) ease;
            }

            header {
              transition: background-color 0.4s ease-in-out, box-shadow 0.4s ease-in-out;
            }

            header.scrolled {
              background-color: rgba(255, 255, 255, 0.8);
              backdrop-filter: blur(8px);
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }

            .dark header.scrolled {
              background-color: rgba(17, 24, 39, 0.8);
            }

            #animated-title-container,
            #main-subtitle-text {
              will-change: transform;
            }

            .knockout-text {
              color: #4b5563;
              text-shadow: 0px 0px 4px white, 0px 0px 6px white, 0px 0px 8px white;
            }

            .dark .knockout-text {
              color: #9ca3af;
              text-shadow: 0px 0px 4px #111827, 0px 0px 6px #111827, 0px 0px 8px #111827;
            }

            .project-image-container:hover {
              transform: scale(1.03);
            }

            #to-top-btn {
              transition: opacity 0.3s ease, transform 0.3s ease, background-color var(--theme-transition-duration) ease, color var(--theme-transition-duration) ease;
            }

            #loader {
              transition: opacity 0.5s ease;
              background-color: white;
            }

            .dark #loader {
              background-color: #111827;
            }

            #loader.hidden {
              opacity: 0;
              pointer-events: none;
            }

            .loader-dot {
              width: 16px;
              height: 16px;
              background-color: #9ca3af;
              border-radius: 50%;
              animation: pulse 1.5s infinite ease-in-out;
            }

            .dark .loader-dot {
              background-color: #4b5563;
            }

            @keyframes pulse {
              0%, 100% {
                transform: scale(0.8);
                opacity: 0.8;
              }
              50% {
                transform: scale(1.2);
                opacity: 1;
              }
            }
          `
        }} />

      </head>
      <body className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 theme-transition">
        <div id="loader" className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="loader-dot"></div>
        </div>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// ダークモード初期化
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
  React.useEffect(() => {
    // React アプリが起動したらローダーを隠す
    const hideLoader = () => {
      const loader = document.getElementById('loader');
      if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
      }
    };
    
    // 即座に実行
    hideLoader();
    
    // 少し遅延させても実行（保険）
    const timeoutId = setTimeout(hideLoader, 50);
    
    return () => clearTimeout(timeoutId);
  }, []);

  return <Outlet />;
}