import { isSameOriginRequest } from "../request-origin.server";

export function jsonNoStore(
  data: unknown,
  init: number | ResponseInit = 200,
) {
  const responseInit: ResponseInit =
    typeof init === "number" ? { status: init } : { ...init };
  const headers = new Headers(responseInit.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return Response.json(data, { ...responseInit, headers });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  retryable = false,
) {
  return jsonNoStore(
    { error: { code, message, retryable } },
    { status },
  );
}

export function requirePost(request: Request) {
  if (request.method.toUpperCase() !== "POST") {
    throw jsonError(405, "METHOD_NOT_ALLOWED", "POSTのみ利用できます。");
  }
  if (!isSameOriginRequest(request)) {
    throw jsonError(403, "FORBIDDEN_ORIGIN", "このリクエスト元からは利用できません。");
  }
}

export function requirePut(request: Request) {
  if (request.method.toUpperCase() !== "PUT") {
    throw jsonError(405, "METHOD_NOT_ALLOWED", "PUTのみ利用できます。");
  }
  if (!isSameOriginRequest(request)) {
    throw jsonError(403, "FORBIDDEN_ORIGIN", "このリクエスト元からは利用できません。");
  }
}
