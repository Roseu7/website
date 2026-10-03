import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { routeModules, pageRoutes } from "./route-registry.server";
import { isDataResult, type AppLoadContext, type LoaderFunctionArgs, type JsonValue } from "./http";
import { requireSameOriginRequest } from "~/utils/request-origin.server";

type RouteModule = { loader?: (args: LoaderFunctionArgs) => unknown; action?: (args: LoaderFunctionArgs) => unknown };
async function moduleFor(route: string): Promise<RouteModule> {
  if (!Object.hasOwn(routeModules, route)) throw new Response("Not Found", { status: 404 });
  return routeModules[route as keyof typeof routeModules].load() as Promise<RouteModule>;
}
function responseFor(value: unknown): Response {
  if (value instanceof Response) return value;
  if (isDataResult(value)) return Response.json(value.data, value.init);
  return Response.json(value ?? null);
}
async function invoke(fn: RouteModule["loader"], args: LoaderFunctionArgs) {
  try { return await fn?.(args); }
  catch (error) { if (error instanceof Response) return error; throw error; }
}
function paramsFor(route: string, pathname: string): Record<string, string> {
  const routeParts = route.split("/").slice(1);
  const pathParts = pathname.split("/").slice(1);
  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const part = routeParts[i];
    if (part === "*") { params["*"] = pathParts.slice(i).join("/"); return params; }
    if (pathParts[i] === undefined) throw new Response("Not Found", { status: 404 });
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(pathParts[i]);
    else if (part !== pathParts[i]) throw new Response("Not Found", { status: 404 });
  }
  if (pathParts.length !== routeParts.length) throw new Response("Not Found", { status: 404 });
  return params;
}
export type PageResult =
  | { kind: "data"; data: JsonValue }
  | { kind: "redirect"; href: string; status: number }
  | { kind: "error"; status: number; message: string };

export async function loadPageOnServer(route: string, href: string, context: AppLoadContext): Promise<PageResult> {
  if (!pageRoutes.has(route)) return { kind: "error", status: 404, message: "Not Found" };
  const current = getRequest();
  const url = new URL(href, current.url);
  if (url.origin !== new URL(current.url).origin) return { kind: "error", status: 400, message: "Invalid page origin." };
  try {
    const params = paramsFor(route, url.pathname);
    const module = await moduleFor(route);
    const request = new Request(url, { headers: current.headers, method: "GET" });
    const value = await invoke(module.loader, { request, context, params });
    if (!(value instanceof Response) && !isDataResult(value)) return { kind: "data", data: JSON.parse(JSON.stringify(value ?? null)) as JsonValue };
    const response = responseFor(value);
    if (!new URL(current.url).pathname.startsWith("/_serverFn/")) setResponseStatus(response.status);
    for (const [name, value] of response.headers) {
      if (name !== "content-type" && name !== "location") setResponseHeader(name, value);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.has("Location")) {
      return { kind: "redirect", href: response.headers.get("Location")!, status: response.status };
    }
    if (response.status === 404) return { kind: "error", status: 404, message: "Not Found" };
    if (response.headers.get("Content-Type")?.includes("application/json")) return { kind: "data", data: await response.json() };
    return { kind: "error", status: response.status, message: await response.text() };
  } catch (error) {
    if (error instanceof Response) return { kind: "error", status: error.status, message: await error.text() };
    throw error;
  }
}
export async function serveResource(route: string, request: Request, params: Record<string, string>, context: AppLoadContext) {
  const module = await moduleFor(route);
  // TanStack uses _splat for wildcard routes; existing proxy code uses '*'.
  if (params._splat !== undefined) params = { ...params, "*": params._splat };
  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return new Response("Method Not Allowed", { status: 405 });
  const fn = method === "GET" || method === "HEAD" ? module.loader : module.action;
  if (!fn) return new Response("Method Not Allowed", { status: 405, headers: { Allow: module.loader ? "GET, HEAD" : "POST" } });
  const response = responseFor(await invoke(fn, { request, params, context }));
  return method === "HEAD" ? new Response(null, response) : response;
}
export async function runPageAction(route: string, request: Request, params: Record<string, string>, context: AppLoadContext) {
  try { requireSameOriginRequest(request); }
  catch (error) { if (error instanceof Response) return error; throw error; }
  const module = await moduleFor(route);
  if (!module.action) return new Response("Method Not Allowed", { status: 405 });
  return responseFor(await invoke(module.action, { request, params, context }));
}
export async function servePageAction(route: string, request: Request, params: Record<string, string>, context: AppLoadContext) {
  const response = await runPageAction(route, request, params, context);
  if (request.headers.get("X-Website-Action") === "1" && response.headers.has("Location")) {
    const headers = new Headers(response.headers); headers.delete("Location");
    return Response.json({ redirect: response.headers.get("Location") }, { headers });
  }
  if (request.headers.get("X-Website-Action") !== "1" && response.headers.get("Content-Type")?.includes("application/json")) {
    const { default: handler } = await import("@tanstack/react-start/server-entry");
    const rendered = await handler.fetch(new Request(request.url, { headers: request.headers }), {
      context: { ...context, nonce: context.cspNonce, pageAction: { route, data: await response.json() } },
    });
    const headers = new Headers(rendered.headers);
    for (const [name, value] of response.headers) if (name !== "content-type") headers.set(name, value);
    return new Response(rendered.body, { status: response.status, headers });
  }
  return response;
}
