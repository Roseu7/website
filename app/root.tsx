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
                function hideLoader() {
                  document.getElementById('app-loader')?.classList.add('is-hidden');
                }

                document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
                window.setTimeout(hideLoader, 8000);
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
            <span className="app-loader__bar" aria-hidden="true" />
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
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <>
      <div
        className={`route-loader${isNavigating ? " is-loading" : ""}`}
        role="progressbar"
        aria-label="ページを読み込み中"
        aria-hidden={!isNavigating}
      >
        <span className="route-loader__bar" />
      </div>
      <Outlet />
    </>
  );
}
