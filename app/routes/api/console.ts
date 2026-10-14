import type { ActionFunctionArgs } from "~/framework/http";
import { readLimitedJsonObject } from "~/utils/request-body.server";
import { isSameOriginRequest } from "~/utils/request-origin.server";
import { CONSOLE_COMMAND_LIMIT, CONSOLE_SESSION_DURATION } from "~/utils/console";
import type { ConsoleSession } from "../../../workers/console";
import { consoleMayWrite, readConsoleShells, runConsoleRequest, signConsoleSession, verifyConsoleSession, verifyConsoleResume } from "~/utils/console-session.server";

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
  try { body = await readLimitedJsonObject(request, 96 * 1024); }
  catch (cause) { return error(cause instanceof Response ? cause.status : 400, "Invalid command request."); }
  if (body.operation === "resume") {
    if (Object.keys(body).some(key => !["operation", "sessionId", "resumeTicket"].includes(key))
      || typeof body.sessionId !== "string" || !/^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.sessionId)
      || typeof body.resumeTicket !== "string" || body.resumeTicket.length > 1024) return error(400, "Invalid Guest workspace.");
    const created = Number(body.sessionId.slice(0, 13));
    if (created > Date.now() + 30_000 || created + CONSOLE_SESSION_DURATION <= Date.now()) return error(410, "Guest workspace expired.");
    try { await verifyConsoleResume(body.resumeTicket, body.sessionId, context.cloudflare.env.CONSOLE_SESSION_SECRET); }
    catch { return error(403, "Invalid Guest workspace."); }
    // A resume ticket selects a Guest filesystem, never a logged-in identity or shell state.
    // Keep resumed reads coordinated with writes that may still be arriving from the discarded page.
    const proof = await signConsoleSession(body.sessionId, true, context.cloudflare.env.CONSOLE_SESSION_SECRET);
    return Response.json({ proof }, { headers });
  }
  if (typeof body.command !== "string" || body.command.length > CONSOLE_COMMAND_LIMIT || /[\x00-\x08\x0a-\x1f\x7f]/.test(body.command)
    || typeof body.sessionId !== "string" || !/^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.sessionId)) return error(400, "Invalid command request.");
  if (Object.keys(body).some(key => !["command", "sessionId", "operation", "cursor", "proof", "shells"].includes(key))) return error(400, "Invalid command request.");
  const shells = readConsoleShells(body.shells);
  if (!shells || typeof body.proof !== "string" || body.proof.length > 1024) return error(400, "Invalid command request.");
  const created = Number(body.sessionId.slice(0, 13));
  const expires = created + CONSOLE_SESSION_DURATION;
  if (created > Date.now() + 30_000 || expires <= Date.now()) return error(410, "Session expired. Reopen the command prompt.");
  if (body.operation !== undefined && body.operation !== "complete") return error(400, "Invalid command request.");
  if (body.operation === "complete") {
    if (!Number.isInteger(body.cursor) || (body.cursor as number) < 0 || (body.cursor as number) > body.command.length) return error(400, "Invalid completion cursor.");
  }
  let claim: Awaited<ReturnType<typeof verifyConsoleSession>>;
  try { claim = await verifyConsoleSession(body.proof, body.sessionId, context.cloudflare.env.CONSOLE_SESSION_SECRET); }
  catch { return error(403, "Invalid session proof. Reopen the command prompt."); }
  if (claim.expired) {
    // Renew only the unauthenticated Guest session; do not execute with an expired proof.
    const proof = await signConsoleSession(body.sessionId, claim.files, context.cloudflare.env.CONSOLE_SESSION_SECRET);
    return Response.json({ error: "Guest session proof renewed. Retry the command.", proof }, { status: 401, headers });
  }
  try {
    const cursor = body.operation === "complete" ? body.cursor as number : null;
    let result, nextShells, hasFiles = claim.files;
    if (!claim.files && (cursor !== null || !consoleMayWrite(body.command, shells))) {
      const reply = runConsoleRequest(body.command, shells, cursor);
      result = reply.result;
      nextShells = reply.shells;
    } else {
      // cf's string Worker references omit RPC method types; use the exported class's actual contract.
      const session = context.cloudflare.env.CONSOLE_SESSIONS.getByName(body.sessionId) as DurableObjectStub & Pick<ConsoleSession, "run">;
      const reply = await session.run(body.command, shells, cursor, expires);
      result = reply.result;
      nextShells = reply.shells;
      hasFiles = claim.files || reply.hasFiles;
    }
    const proof = await signConsoleSession(body.sessionId, hasFiles, context.cloudflare.env.CONSOLE_SESSION_SECRET);
    return Response.json({ ...result, shells: nextShells, proof }, { headers });
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("Session expired.")) return error(410, "Session expired. Reopen the command prompt.");
    if (cause instanceof Error && cause.message.includes("Invalid console directory.")) return error(400, "Invalid console directory.");
    return error(503, "The command service is unavailable.");
  }
}
