import type { ActionFunctionArgs } from "~/framework/http";
import { readLimitedJsonObject } from "~/utils/request-body.server";
import { isSameOriginRequest } from "~/utils/request-origin.server";
import { CONSOLE_COMMAND_LIMIT } from "~/utils/console";
import type { ConsoleSession } from "../../../workers/console";

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
    || typeof body.sessionId !== "string" || !/^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.sessionId)) return error(400, "Invalid command request.");
  if (Object.keys(body).some(key => !["command", "sessionId", "operation", "cursor"].includes(key))) return error(400, "Invalid command request.");
  const created = Number(body.sessionId.slice(0, 13));
  const expires = created + 2 * 60 * 60 * 1000;
  if (created > Date.now() + 30_000 || expires <= Date.now()) return error(410, "Session expired. Reopen the command prompt.");
  if (body.operation !== undefined && body.operation !== "complete") return error(400, "Invalid command request.");
  if (body.operation === "complete") {
    if (!Number.isInteger(body.cursor) || (body.cursor as number) < 0 || (body.cursor as number) > body.command.length) return error(400, "Invalid completion cursor.");
  }
  try {
    // cf's string Worker references omit RPC method types; use the exported class's actual contract.
    const session = context.cloudflare.env.CONSOLE_SESSIONS.getByName(body.sessionId) as DurableObjectStub & Pick<ConsoleSession, "run">;
    const result = await session.run(body.command, body.operation === "complete" ? body.cursor as number : null, expires);
    return Response.json(result, { headers });
  } catch { return error(503, "The command service is unavailable."); }
}
