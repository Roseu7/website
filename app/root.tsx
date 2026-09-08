import * as React from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { MAIN_SITE_HOSTS } from "~/utils/host-config";

import "./styles/app.css";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { hostname } = new URL(request.url);
  const isMainSiteHost = MAIN_SITE_HOSTS.has(hostname);

  return {
    cspNonce: context.cspNonce,
    topPageHref: isMainSiteHost ? "/" : "https://roseu.net/",
  };
}

export const links: LinksFunction = () => [
  {
    rel: "preload",
    href: "/fonts/NotoSansJP/NotoSansJP-Regular.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>("root");
  // Keep the document nonce when loaders revalidate during client navigation.
  const [nonce] = React.useState(rootData?.cspNonce);
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links nonce="" />
        <DarkModeScript nonce={nonce} />
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const isMcDashboardHost = window.location.hostname === 'mc.roseu.net';
                const LOADER_MIN_MS = isMcDashboardHost ? 180 : 560;
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
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

function DarkModeScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      // Browsers hide nonce content attributes after parsing; the nonce property remains set.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            try {
              var saved = localStorage.getItem('theme');
              if (saved !== null) isDark = saved === 'dark';
            } catch (_) {}

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
