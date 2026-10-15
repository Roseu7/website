import type { ActionFunctionArgs } from "~/framework/http";
import { readLimitedJsonObject } from "~/utils/request-body.server";
import { isSameOriginRequest } from "~/utils/request-origin.server";
import { CONSOLE_COMMAND_LIMIT, CONSOLE_SESSION_DURATION, createConsoleShell } from "~/utils/console";
import type { ConsoleSession } from "../../../workers/console";
import { consoleMayWrite, readConsoleShells, runConsoleRequest, signConsoleSession, verifyConsoleSession, verifyConsoleResume, signConsoleRegistration, verifyConsoleRegistration } from "~/utils/console-session.server";

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
  const extraKeys = body.operation === "save" ? ["path", "text"] : body.operation === "password" || body.operation === "cancel" ? ["challenge"] : [];
  if (Object.keys(body).some(key => !["command", "sessionId", "operation", "cursor", "proof", "shells", "registration", ...extraKeys].includes(key))) return error(400, "Invalid command request.");
  if (body.registration !== undefined && (typeof body.registration !== "string" || body.registration.length > 2048)) return error(400, "Invalid command request.");
  const shells = readConsoleShells(body.shells);
  if (!shells || typeof body.proof !== "string" || body.proof.length > 1024) return error(400, "Invalid command request.");
  const created = Number(body.sessionId.slice(0, 13));
  const expires = created + CONSOLE_SESSION_DURATION;
  if (created > Date.now() + 30_000 || expires <= Date.now()) return error(410, "Session expired. Reopen the command prompt.");
  if (body.operation !== undefined && !["complete", "password", "cancel", "save", "developer"].includes(String(body.operation))) return error(400, "Invalid command request.");
  if (body.operation === "developer" && body.command !== "") return error(400, "Invalid command request.");
  if (body.operation === "save" && (body.command !== "" || typeof body.path !== "string" || !body.path || body.path.length > 260 || typeof body.text !== "string" || body.text.length > 64 * 1024 || body.text.includes("\0"))) return error(400, "Invalid editor request.");
  if ((body.operation === "password" || body.operation === "cancel") && (typeof body.challenge !== "string" || !/^[0-9a-f-]{36}$/.test(body.challenge) || body.operation === "cancel" && body.command !== "")) return error(400, "Invalid password request.");
  if (body.operation !== "complete" && body.cursor !== undefined) return error(400, "Invalid command request.");
  if (body.operation === "complete") {
    if (!Number.isInteger(body.cursor) || (body.cursor as number) < 0 || (body.cursor as number) > body.command.length) return error(400, "Invalid completion cursor.");
  }
  let claim: Awaited<ReturnType<typeof verifyConsoleSession>>;
  try { claim = await verifyConsoleSession(body.proof, body.sessionId, context.cloudflare.env.CONSOLE_SESSION_SECRET); }
  catch { return error(403, "Invalid session proof. Reopen the command prompt."); }
  try {
    let record: Awaited<ReturnType<typeof verifyConsoleRegistration>> | undefined;
    if (typeof body.registration === "string") {
      try { record = await verifyConsoleRegistration(body.registration, body.sessionId, context.cloudflare.env.CONSOLE_SESSION_SECRET); }
      catch { record = undefined; }
    }
    const session = () => context.cloudflare.env.CONSOLE_SESSIONS.getByName(body.sessionId as string) as DurableObjectStub & Pick<ConsoleSession, "run" | "openDeveloper">;
    if (claim.expired) {
      if (claim.principal === "Roseu") {
        const same = record && record.path === claim.record!.path && record.hash === claim.record!.hash;
        const verified = same ? await session().openDeveloper(record, expires) : null;
        if (!verified) {
          const shell = createConsoleShell(), proof = await signConsoleSession(body.sessionId, true, context.cloudflare.env.CONSOLE_SESSION_SECRET);
          return Response.json({ cwd: shell.cwd, output: "Migration record is no longer valid. Returned to Guest.", input: "command", shells: [shell], proof, registration: null, reset: true }, { headers });
        }
      }
      const proof = await signConsoleSession(body.sessionId, claim.files, context.cloudflare.env.CONSOLE_SESSION_SECRET, claim.principal === "Roseu" ? record : undefined);
      return Response.json({ error: `${claim.principal === "Guest" ? "Guest" : "Console"} session proof renewed. Retry the command.`, proof }, { status: 401, headers });
    }
    if (body.operation === "developer") {
      const verified = await session().openDeveloper(record, expires);
      if (!verified) return Response.json({ cwd: shells.at(-1)!.cwd, output: "Access is denied.", registration: null, shells, proof: body.proof }, { headers });
      const proof = await signConsoleSession(body.sessionId, true, context.cloudflare.env.CONSOLE_SESSION_SECRET, verified.registration);
      return Response.json({ ...verified.result, shells: verified.shells, proof }, { headers });
    }
    const incomingRecord = record;
    if (claim.principal === "Roseu") record = claim.record;
    const cursor = body.operation === "complete" ? body.cursor as number : null;
    let result, nextShells, hasFiles = claim.files;
    let registration: string | null | undefined = body.registration === undefined ? undefined : null;
    if (claim.principal === "Guest" && !record && !claim.files && (body.operation === undefined || body.operation === "complete") && (cursor !== null || !consoleMayWrite(body.command, shells))) {
      const reply = runConsoleRequest(body.command, shells, cursor, undefined, created);
      result = reply.result;
      nextShells = reply.shells;
    } else {
      // cf's string Worker references omit RPC method types; use the exported class's actual contract.
      const operation = body.operation === "save" ? { kind: "save" as const, path: body.path as string, text: body.text as string } : body.operation === "password" || body.operation === "cancel" ? { kind: body.operation as "password" | "cancel", challenge: body.challenge as string } : undefined;
      const reply = await session().run(body.command, shells, cursor, expires, operation, record, claim.principal);
      result = reply.result;
      nextShells = reply.shells;
      hasFiles = claim.files || reply.hasFiles;
      if (reply.registration) {
        if (incomingRecord?.path === reply.registration.path && incomingRecord.hash === reply.registration.hash) registration = body.registration as string;
        else if ("registered" in reply && reply.registered) registration = await signConsoleRegistration(body.sessionId, reply.registration, context.cloudflare.env.CONSOLE_SESSION_SECRET);
      }
    }
    // Keep the current Roseu expiry. Renewal always goes through the record checks above.
    const proof = claim.principal === "Roseu" ? body.proof : await signConsoleSession(body.sessionId, hasFiles, context.cloudflare.env.CONSOLE_SESSION_SECRET);
    return Response.json({ ...result, ...(registration !== undefined ? { registration } : {}), shells: nextShells, proof }, { headers });
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("Session expired.")) return error(410, "Session expired. Reopen the command prompt.");
    if (cause instanceof Error && cause.message.includes("Invalid console directory.")) return error(400, "Invalid console directory.");
    return error(503, "The command service is unavailable.");
  }
}
