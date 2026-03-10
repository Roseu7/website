import * as React from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
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
            <span className="app-loader__spinner" aria-hidden="true" />
            <span className="sr-only">読み込み中</span>
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
  useRouteLoaderOverlay();
  return <Outlet />;
}

function useRouteLoaderOverlay() {
  const navigation = useNavigation();
  const showTimerRef = React.useRef<number | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const shownAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const loader = document.getElementById("app-loader");
    if (!(loader instanceof HTMLElement)) {
      return;
    }

    const clearShowTimer = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const showLoader = () => {
      shownAtRef.current = Date.now();
      loader.classList.remove("is-hidden");
      loader.classList.add("is-route-loading");
    };

    const hideLoader = () => {
      loader.classList.remove("is-route-loading");
      loader.classList.add("is-hidden");
      shownAtRef.current = null;
    };

    const isNavigating = navigation.state !== "idle";

    if (isNavigating) {
      clearHideTimer();
      if (!loader.classList.contains("is-route-loading")) {
        clearShowTimer();
        showTimerRef.current = window.setTimeout(showLoader, 90);
      }
    } else {
      clearShowTimer();
      if (loader.classList.contains("is-route-loading")) {
        const elapsed =
          shownAtRef.current === null ? 0 : Date.now() - shownAtRef.current;
        const remaining = Math.max(0, 260 - elapsed);
        clearHideTimer();
        hideTimerRef.current = window.setTimeout(hideLoader, remaining);
      }
    }

    return () => {
      clearShowTimer();
      clearHideTimer();
    };
  }, [navigation.state]);
}
