import { compactVerify, jwtVerify, SignJWT } from "jose";
import { CONSOLE_SESSION_DURATION, type ConsoleShell } from "./console";
import { createConsoleState, executeConsole, completeConsole, getConsoleDirectory, consoleWritesFiles, finishConsolePassword, saveConsoleEditor, type ConsoleState, type ConsolePassword } from "./console.server";

const audience = "ros3u-console", lifetime = 5 * 60;
const signingKey = (secret: string) => {
  if (!secret || secret.length < 32) throw Error("Console signing key is unavailable.");
  return new TextEncoder().encode(secret);
};

export async function signConsoleSession(sessionId: string, files: boolean, secret: string, record?: { path: string; hash: string }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: sessionId, files, ...(record ? { record } : {}) }).setProtectedHeader({ alg: "HS256" }).setSubject(record ? "Roseu" : "Guest")
    .setAudience(audience).setIssuedAt(now).setExpirationTime(Math.min(now + lifetime, Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000))).sign(signingKey(secret));
}

export async function signConsoleResume(sessionId: string, secret: string) {
  return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: "HS256" }).setSubject("Guest")
    .setAudience("ros3u-console-resume").setIssuedAt()
    .setExpirationTime(Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000)).sign(signingKey(secret));
}

export async function verifyConsoleResume(ticket: string, sessionId: string, secret: string) {
  const { payload } = await jwtVerify(ticket, signingKey(secret), { algorithms: ["HS256"], audience: "ros3u-console-resume", subject: "Guest" });
  if (payload.sid !== sessionId || payload.exp !== Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000)) throw Error("Invalid Guest workspace.");
}

export async function signConsoleRegistration(sessionId: string, record: { path: string; hash: string }, secret: string) {
  return new SignJWT({ sid: sessionId, ...record }).setProtectedHeader({ alg: "HS256" }).setSubject("Guest")
    .setAudience("ros3u-console-registration").setIssuedAt()
    .setExpirationTime(Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000)).sign(signingKey(secret));
}

export async function verifyConsoleRegistration(ticket: string, sessionId: string, secret: string) {
  const { payload } = await jwtVerify(ticket, signingKey(secret), { algorithms: ["HS256"], audience: "ros3u-console-registration", subject: "Guest" });
  if (payload.sid !== sessionId || payload.exp !== Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000)
    || typeof payload.path !== "string" || payload.path.length > 260 || !/^C:\\/.test(payload.path)
    || typeof payload.hash !== "string" || !/^[0-9a-f]{64}$/.test(payload.hash)) throw Error("Invalid registration proof.");
  return { path: payload.path, hash: payload.hash };
}

export async function verifyConsoleSession(proof: string, sessionId: string, secret: string) {
  const { payload, protectedHeader } = await compactVerify(proof, signingKey(secret), { algorithms: ["HS256"] });
  const claim = JSON.parse(new TextDecoder().decode(payload));
  const now = Math.floor(Date.now() / 1000);
  if (protectedHeader.alg !== "HS256" || claim.aud !== audience || claim.sid !== sessionId || !["Guest", "Roseu"].includes(claim.sub)
    || typeof claim.files !== "boolean" || !Number.isInteger(claim.iat) || claim.iat > now + 30
    || !Number.isInteger(claim.exp) || claim.exp !== Math.min(claim.iat + lifetime, Math.floor((Number(sessionId.slice(0, 13)) + CONSOLE_SESSION_DURATION) / 1000))) throw Error("Invalid console proof.");
  if (claim.sub === "Roseu" && (!claim.record || typeof claim.record.path !== "string" || claim.record.path.length > 260 || !/^C:\\/.test(claim.record.path)
    || typeof claim.record.hash !== "string" || !/^[0-9a-f]{64}$/.test(claim.record.hash))) throw Error("Invalid console proof.");
  // Signature validation is separate from expiry: the API must recheck a registered record before renewing Roseu.
  return { files: claim.files as boolean, expired: claim.exp <= now, principal: claim.sub as ConsoleState["principal"], record: claim.sub === "Roseu" ? { path: claim.record.path as string, hash: claim.record.hash as string } : undefined };
}

export function readConsoleShells(value: unknown): ConsoleShell[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 8) return null;
  for (const item of value) {
    if (!item || typeof item !== "object" || Object.keys(item).some(key => !["cwd", "env", "errorlevel", "echo", "pending"].includes(key))
      || typeof item.cwd !== "string" || item.cwd.length > 260 || !/^C:\\/.test(item.cwd)
      || !Number.isSafeInteger(item.errorlevel) || typeof item.echo !== "boolean"
      || !item.env || typeof item.env !== "object" || Array.isArray(item.env)
      || Object.keys(item.env).length > 64 || JSON.stringify(item.env).length > 8192
      || Object.entries(item.env).some(([key, value]) => !key || key !== key.toUpperCase() || /[\x00-\x1f]/.test(key) || typeof value !== "string")) return null;
    if (item.pending !== undefined && (!item.pending || typeof item.pending !== "object"
      || Object.keys(item.pending).some(key => !["command", "question"].includes(key))
      || typeof item.pending.command !== "string" || item.pending.command.length > 2048
      || typeof item.pending.question !== "string" || item.pending.question.length > 1024)) return null;
  }
  return value;
}

// Only obvious reads bypass filesystem coordination. EXE resolution, redirection, and compound commands use the DO.
export function consoleMayWrite(command: string, shells: ConsoleShell[]) {
  return consoleWritesFiles(command, { principal: "Guest", files: initialFiles, shells });
}

const initialFiles = createConsoleState().files;
Object.freeze(initialFiles);

export function runConsoleRequest(command: string, shells: ConsoleShell[], cursor: number | null, files = initialFiles, created = Date.now(), action?: { kind: "password"; pending: ConsolePassword } | { kind: "save"; path: string; text: string }, authority?: Pick<ConsoleState, "principal" | "migration">) {
  const state: ConsoleState = { principal: "Guest", ...authority, files: [...files], shells: structuredClone(shells), created };
  for (const shell of state.shells) {
    const cwd = getConsoleDirectory(shell.cwd, state);
    if (!cwd) throw Error("Invalid console directory.");
    shell.cwd = cwd;
  }
  const result = action?.kind === "password" ? finishConsolePassword(command, state, action.pending) : action?.kind === "save" ? saveConsoleEditor(action.path, action.text, state) : cursor === null ? executeConsole(command, state) : completeConsole(command, state, cursor);
  return { result, shells: state.shells, files: state.files, password: state.password, registration: state.registration };
}
