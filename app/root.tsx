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
import { siteConfig } from "~/utils/site";

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
    href: "/fonts/NotoSansJP/NotoSansJP-Regular.woff2",
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
];

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderWordmark = siteConfig.name.split(" ");

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <DarkModeScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const LOADER_MIN_MS = 560;
                const LOADER_MAX_WAIT_MS = 8000;
                const startedAt = Date.now();

                function hideLoader() {
                  const loader = document.getElementById('app-loader');
                  if (!loader || loader.classList.contains('is-hidden')) return;

                  const elapsed = Date.now() - startedAt;
                  const remaining = Math.max(0, LOADER_MIN_MS - elapsed);

                  window.setTimeout(function() {
                    loader.classList.add('is-hidden');
                  }, remaining);
                }

                window.addEventListener('load', hideLoader, { once: true });
                window.setTimeout(hideLoader, LOADER_MAX_WAIT_MS);
              })();
            `,
          }}
        />
      </head>
      <body className="site-body theme-transition">
        <div
          id="theme-transition-layer"
          className="theme-transition-layer"
          aria-hidden="true"
        />
        <div id="app-loader" className="app-loader" aria-hidden="true">
          <div className="app-loader__inner">
            <div className="app-loader__wordmark">
              {loaderWordmark.map((word) => (
                <span key={word}>{word}</span>
              ))}
            </div>
            <span className="app-loader__line" />
          </div>
        </div>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function DarkModeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var isDark = localStorage.getItem('theme') === 'dark' ||
              (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

            document.documentElement.classList.toggle('dark', isDark);
          })();
        `,
      }}
    />
  );
}

export default function App() {
  return <Outlet />;
}
