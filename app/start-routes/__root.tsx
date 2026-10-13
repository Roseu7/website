import { useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouter, useRouterState } from "@tanstack/react-router";
import { loadDocument, OsRouteDataContext } from "~/framework/page";
import { OsShell } from "~/components/os/OsShell";
import { useOsPage } from "~/components/os/OsContext";
import { isOsPath } from "~/utils/os";
import { handleContextMenu } from "~/utils/context-menu";
import { NotFoundPage } from "~/routes/$";
import { errorStatus, StopScreen, SystemErrorDialog } from "~/components/os/SystemError";
import appCss from "~/styles/app.css?url";
import { getPageStyles } from "~/framework/styles";

export const Route = createRootRoute({
  loader: () => loadDocument(),
  head: ({ loaderData, matches }) => {
    const current = matches[matches.length - 1];
    const failed = current.status === "error";
    const stop = current.status === "notFound" || String(current.routeId) === "/$" || (failed && errorStatus(current.error) >= 500);
    const styles = stop ? [] : getPageStyles(current.pathname, loaderData?.osEnabled ?? false, current.loaderData, failed);
    return { meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }], links: [
    ...[appCss, ...styles].map(href => ({ rel: "stylesheet", href, precedence: "app" })),
    { rel: "preload", href: "/fonts/DotGothic16/DotGothic16-Regular.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  ] };
  },
  shellComponent: Document,
  component: Application,
  notFoundComponent: NotFoundApplication,
  errorComponent: ErrorApplication,
});
function Document({ children }: { children: React.ReactNode }) {
  const document = Route.useLoaderData();
  const [nonce] = useState(document?.cspNonce);
  return <html lang="ja" suppressHydrationWarning>
    <head><HeadContent />
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: document?.initialOsPage ? `document.documentElement.classList.remove('dark');` : `(function(){var dark=matchMedia('(prefers-color-scheme: dark)').matches;try{var saved=localStorage.getItem('theme');if(saved!==null)dark=saved==='dark'}catch(_){}document.documentElement.classList.toggle('dark',dark)})();` }} />
    </head>
    <body className="site-body theme-transition" onContextMenu={handleContextMenu}><div id="theme-transition-layer" className="theme-transition-layer" aria-hidden="true" />
      {children}<Scripts />
    </body>
  </html>;
}
function ErrorApplication({ error }: { error: unknown }) {
  const document = Route.useLoaderData();
  const status = errorStatus(error);
  const stop = status === 404 || status >= 500;
  return <OsShell enabled={document?.osEnabled ?? true} notFound={stop} systemError>
    {stop ? <StopScreen status={status} /> : <SystemErrorDialog status={status} />}
  </OsShell>;
}
function Application() {
  const router = useRouter();
  const document = Route.useLoaderData();
  const match = useRouterState({ select: s => s.matches[s.matches.length - 1] });
  const loading = useRouterState({ select: s => s.status === "pending" });
  const missing = match.status === "notFound" || match.routeId === "/$";
  const failed = match.status === "error";
  const status = failed ? errorStatus(match.error) : undefined;
  const stop = missing || (status !== undefined && status >= 500);
  const Page = router.routesById[match.routeId]?.options.component;
  // Outlet follows the active match; capture the page and data to retain independent windows.
  let content = <Outlet />;
  if (missing) content = <NotFoundPage />;
  else if (status !== undefined) content = status >= 500 ? <StopScreen status={status} /> : <SystemErrorDialog status={status} />;
  else if (document?.osEnabled && isOsPath(match.pathname)) {
    if (match.status === "success" && match.routeId !== Route.id && Page) {
      content = <OsRouteDataContext.Provider value={{ data: match.loaderData }}><Page /></OsRouteDataContext.Provider>;
    }
  }
  return <><div className={`route-loader${loading ? " is-loading" : ""}`} role="progressbar" aria-label="ページを読み込み中" aria-hidden={!loading}><span className="route-loader__bar" /></div><OsShell enabled={document?.osEnabled ?? false} notFound={stop} systemError={failed}>{content}</OsShell></>;
}
function NotFoundApplication() {
  const document = Route.useLoaderData();
  const insideOs = useOsPage();
  if (insideOs) return <NotFoundPage />;
  return <OsShell enabled={document?.osEnabled ?? false} notFound><NotFoundPage /></OsShell>;
}
