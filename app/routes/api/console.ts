import type { ActionFunctionArgs } from "~/framework/http";
import { readLimitedJsonObject } from "~/utils/request-body.server";
import { isSameOriginRequest } from "~/utils/request-origin.server";
import { CONSOLE_COMMAND_LIMIT } from "~/utils/console";
import { executeConsole, getConsoleDirectory } from "~/utils/console.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  const error = (status: number, message: string, extra = {}) => Response.json({ error: message }, { status, headers: { ...headers, ...extra } });
  if (request.method !== "POST") return error(405, "POST only.", { Allow: "POST" });
  if (!isSameOriginRequest(request)) return error(403, "Forbidden.");
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return error(415, "JSON required.");
  try {
    const { success } = await context.cloudflare.env.CONSOLE_RATE_LIMITER.limit({ key: `console:${request.headers.get("CF-Connecting-IP") ?? "unknown"}` });
    if (!success) return error(429, "Too many commands.", { "Retry-After": "60" });
  } catch {
    return error(503, "The command service is unavailable.");
  }
  let body: Record<string, unknown>;
  try { body = await readLimitedJsonObject(request, 4096); }
  catch (cause) { return error(cause instanceof Response ? cause.status : 400, "Invalid command request."); }
  if (typeof body.command !== "string" || body.command.length > CONSOLE_COMMAND_LIMIT || /[\x00-\x08\x0a-\x1f\x7f]/.test(body.command)
    || typeof body.cwd !== "string" || body.cwd.length > 260) return error(400, "Invalid command request.");
  const cwd = getConsoleDirectory(body.cwd);
  if (!cwd) return error(400, "Invalid working directory.");
  const result = executeConsole(body.command, cwd);
  const bytes = new TextEncoder().encode(result.output);
  if (bytes.length > 16 * 1024) result.output = new TextDecoder().decode(bytes.slice(0, 16 * 1024 - 64)) + "\r\nOutput limit exceeded.";
  return Response.json(result, { headers });
}
