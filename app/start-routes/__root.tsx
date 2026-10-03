import { useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { loadDocument } from "~/framework/page";
import { NotFoundPage } from "~/routes/$";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  loader: () => loadDocument(),
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }], links: [
    { rel: "stylesheet", href: appCss },
    { rel: "preload", href: "/fonts/NotoSansJP/NotoSansJP-Regular.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  ] }),
  shellComponent: Document,
  component: Application,
  notFoundComponent: NotFoundPage,
  errorComponent: () => <main className="page-stack"><h1>ページを表示できませんでした</h1><p role="alert">時間をおいて、もう一度試してください。</p><a href="/">トップページに戻る</a></main>,
});
function Document({ children }: { children: React.ReactNode }) {
  const document = Route.useLoaderData();
  const [nonce] = useState(document?.cspNonce);
  return <html lang="ja" suppressHydrationWarning>
    <head><HeadContent />
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){var dark=matchMedia('(prefers-color-scheme: dark)').matches;try{var saved=localStorage.getItem('theme');if(saved!==null)dark=saved==='dark'}catch(_){}document.documentElement.classList.toggle('dark',dark)})();` }} />
    </head>
    <body className="site-body theme-transition"><div id="theme-transition-layer" className="theme-transition-layer" aria-hidden="true" />
      {children}<Scripts />
    </body>
  </html>;
}
function Application() {
  const loading = useRouterState({ select: s => s.status === "pending" });
  return <><div className={`route-loader${loading ? " is-loading" : ""}`} role="progressbar" aria-label="ページを読み込み中" aria-hidden={!loading}><span className="route-loader__bar" /></div><Outlet /></>;
}
