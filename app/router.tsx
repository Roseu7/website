import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { routeTree } from "./routeTree.gen";
export function getRouter() {
  return createRouter({ routeTree, ssr: { nonce: getDocumentNonce() }, scrollRestoration: true, defaultPreload: "intent", defaultPreloadStaleTime: 0, defaultStaleTime: 0 });
}
const getDocumentNonce = createIsomorphicFn()
  .server(() => getRequestHeader("X-Website-Nonce"))
  .client(() => document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content);
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: { requestContext: import("./framework/http").AppLoadContext };
  }
}
declare module "@tanstack/react-start" {
  interface Register { server: { requestContext: import("./framework/http").AppLoadContext }; }
}
declare module "@tanstack/router-core" {
  interface Register { server: { requestContext: import("./framework/http").AppLoadContext }; }
}
