import { createContext, useContext, useState, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { notFound, redirect, useRouterState } from "@tanstack/react-router";
import { loadPageOnServer, type PageResult } from "./handlers.server";
import type { AppLoadContext, JsonValue } from "./http";
import { MAIN_SITE_HOSTS, isMcDashboardHost } from "~/utils/host-config";
import { isOsPath } from "~/utils/os";
import { getPageStyles } from "./styles";

export const loadPage = createServerFn({ method: "GET" })
  .validator((value: { route: string; href: string }) => {
    if (!value || typeof value.route !== "string" || typeof value.href !== "string" || value.href.length > 8192) throw new Error("Invalid page request.");
    return value;
  })
  .handler(({ data, context }): Promise<PageResult> => loadPageOnServer(data.route, data.href, context as AppLoadContext));

export interface DocumentData { cspNonce: string; topPageHref: string; legalBaseHref: string; osEnabled: boolean; initialOsPage: boolean; pageAction?: { route: string; data: JsonValue } }
export const loadDocument = createServerFn({ method: "GET" }).handler(({ context }): DocumentData => {
  const document = context as AppLoadContext;
  const url = new URL(getRequest().url);
  const hostname = url.hostname;
  const main = MAIN_SITE_HOSTS.has(hostname);
  const osEnabled = main && !isMcDashboardHost(hostname);
  return { cspNonce: document.cspNonce, topPageHref: main ? "/" : "https://roseu.net/", legalBaseHref: main ? "" : "https://roseu.net", osEnabled, initialOsPage: osEnabled && isOsPath(url.pathname), pageAction: document.pageAction as DocumentData["pageAction"] };
});
export function resolvePage(result: PageResult): unknown {
  if (result.kind === "redirect") throw redirect({ href: result.href, statusCode: result.status, reloadDocument: true });
  if (result.kind === "error") {
    if (result.status === 404) throw notFound();
    // Error's custom fields are lost during SSR hydration; keep the HTTP status serializable.
    throw { status: result.status, message: result.message };
  }
  return result.data;
}
interface PageStateValue {
  route: string;
  pending: boolean;
  actionData: unknown;
  setPending: (value: boolean) => void;
  setActionData: (value: unknown) => void;
}
export const PageContext = createContext<PageStateValue | null>(null);
// Retained OS windows must read their own route's loader result after navigation.
export const OsRouteDataContext = createContext<{ data: unknown } | null>(null);
export function PageState({ route, children }: { route: string; children: ReactNode }) {
  const document = useRouterState({ select: s => s.matches[0]?.loaderData }) as unknown as DocumentData | undefined;
  const [pending, setPending] = useState(false);
  const [actionData, setActionData] = useState<unknown>(document?.pageAction?.route === route ? document.pageAction.data : undefined);
  const data = useRouterState({ select: state => state.matches[state.matches.length - 1]?.loaderData });
  const retained = useContext(OsRouteDataContext);
  // Native React stylesheet resources stay owned by retained windows and deduplicate head() links.
  return <PageContext.Provider value={{ route, pending, actionData, setPending, setActionData }}>
    {getPageStyles(route, document?.osEnabled ?? false, retained?.data ?? data).map(href => <link key={href} rel="stylesheet" href={href} precedence="app" />)}
    {children}
  </PageContext.Provider>;
}
export function usePageState() { return useContext(PageContext); }
export function pageHead(meta: (...args: never[]) => Array<{ [key: string]: string | undefined }>, data: unknown) {
  return { meta: Reflect.apply(meta, undefined, [{ data }]) as ReturnType<typeof meta> };
}
