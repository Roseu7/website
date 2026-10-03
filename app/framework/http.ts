export interface AppLoadContext {
  cspNonce: string;
  cloudflare: { env: Env; ctx: ExecutionContext };
  pageAction?: { route: string; data: unknown };
}

export interface LoaderFunctionArgs {
  request: Request;
  params: Record<string, string | undefined>;
  context: AppLoadContext;
}
export type ActionFunctionArgs = LoaderFunctionArgs;

export interface DataResult<T> {
  readonly type: "website-data";
  readonly data: T;
  readonly init: ResponseInit;
}
export function data<T>(value: T, init: ResponseInit | number = {}): DataResult<T> {
  return { type: "website-data", data: value, init: typeof init === "number" ? { status: init } : init };
}
export function redirect(url: string, init: ResponseInit | number = 302): Response {
  const options = typeof init === "number" ? { status: init } : { status: 302, ...init };
  const headers = new Headers(options.headers);
  headers.set("Location", url);
  return new Response(null, { ...options, headers });
}
export function isDataResult(value: unknown): value is DataResult<unknown> {
  return !!value && typeof value === "object" && "type" in value && value.type === "website-data";
}
type UnwrapData<T> = T extends DataResult<infer D> ? D : T;
export type ResultData<T> = T extends (...args: never[]) => infer R ? UnwrapData<Exclude<Awaited<R>, Response>> : T;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
