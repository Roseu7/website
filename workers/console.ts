import { DurableObject } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { getConsoleChanges, getConsoleRecordText, createPublicDeveloperShell, migrateConsoleFiles, restoreConsoleFiles, type ConsoleChanges, type ConsoleState, type ConsolePassword } from "../app/utils/console.server";
import { runConsoleRequest } from "../app/utils/console-session.server";
import { osVersion, osBuild } from "../app/utils/os-version";
import { CONSOLE_SESSION_DURATION, type ConsoleShell } from "../app/utils/console";

function verifiedRecord(record: { path: string; hash: string } | undefined, files: ConsoleState["files"]) {
  if (!record) return null;
  // This scoped read is allowed only for the signed record supplied by the API, never an arbitrary client path.
  const principal = record.path.toLowerCase().startsWith("c:\\users\\roseu\\") ? "Roseu" : "Guest";
  const text = getConsoleRecordText(record.path, files, principal);
  return text !== null && createHash("sha256").update(text).digest("hex") === record.hash ? { path: record.path, text } : null;
}

export class ConsoleSession extends DurableObject<Env> {
  private changes: ConsoleChanges = { version: 1, entries: [] };
  private saved: string | null = null;
  private alarmScheduled = false;
  private password: { id: string; expires: number; principal: ConsoleState["principal"]; pending: ConsolePassword } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const tables = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session', 'files', 'changes', 'password_request')").toArray();
    if (tables.some(row => row.name === "password_request")) {
      const pending = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM password_request WHERE id = 1").toArray()[0];
      if (pending) this.password = JSON.parse(pending.data);
    }
    const row = tables.some(row => row.name === "changes") ? this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM changes WHERE id = 1").toArray()[0] : undefined;
    if (row) {
      this.changes = getConsoleChanges(restoreConsoleFiles(JSON.parse(row.data)));
      this.saved = JSON.stringify(this.changes);
    } else if (tables.some(row => row.name === "files" || row.name === "session")) {
      const files = tables.some(row => row.name === "files") ? this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM files WHERE id = 1").toArray()[0] : undefined;
      const legacy = files ?? (tables.some(row => row.name === "session") ? this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM session WHERE id = 1").toArray()[0] : undefined);
      let changes: ConsoleChanges = { version: 1, entries: [] };
      if (legacy) {
        const data = JSON.parse(legacy.data);
        const snapshot = files ? data : (data as ConsoleState).files;
        if (!Array.isArray(snapshot)) throw Error("Invalid legacy filesystem.");
        changes = migrateConsoleFiles(snapshot);
      }
      const saved = JSON.stringify(changes);
      // Conversion and retirement of old snapshots commit together; a failed conversion leaves them intact.
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS changes (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO changes (id, data) VALUES (1, ?)", saved);
        this.ctx.storage.sql.exec("DROP TABLE IF EXISTS files");
        this.ctx.storage.sql.exec("DROP TABLE IF EXISTS session");
      });
      this.changes = changes;
      this.saved = saved;
    }
  }

  private clearPassword() {
    if (!this.password) return;
    this.ctx.storage.sql.exec("DELETE FROM password_request WHERE id = 1");
    this.password = null;
  }

  openDeveloper(record: { path: string; hash: string } | undefined, expires: number) {
    if (expires <= Date.now()) throw Error("Session expired.");
    const migration = verifiedRecord(record, restoreConsoleFiles(this.changes));
    if (!migration) return null;
    const shell = createPublicDeveloperShell();
    return { result: { cwd: shell.cwd, output: `R OS.3u [Version ${osVersion} (Build ${osBuild})] Public Developer Mode\r\nMigration record: ${migration.path} (verified)` }, shells: [shell], registration: record! };
  }

  async run(command: string, shells: ConsoleShell[], cursor: number | null, expires: number, operation?: { kind: "password" | "cancel"; challenge: string } | { kind: "save"; path: string; text: string }, record?: { path: string; hash: string }, principal: ConsoleState["principal"] = "Guest") {
    if (expires <= Date.now()) throw Error("Session expired.");
    const files = restoreConsoleFiles(this.changes);
    // The API verifies the signature and workspace before passing this claim over private RPC.
    const validateRecord = (currentFiles: typeof files) => {
      if (!record) return undefined;
      return verifiedRecord(record, currentFiles) ? record : null;
    };
    if (this.password && this.password.expires <= Date.now()) this.clearPassword();
    if (this.password && !operation) {
      if (cursor !== null) return { result: { start: cursor, end: cursor, candidates: [] }, shells, hasFiles: true, registration: validateRecord(files) };
      this.clearPassword();
    }
    let pending: ConsolePassword | undefined;
    if (operation?.kind === "password" || operation?.kind === "cancel") {
      if (!this.password || this.password.id !== operation.challenge || this.password.principal !== principal || this.password.expires <= Date.now()) {
        return { result: { cwd: shells.at(-1)!.cwd, output: "The password request expired. Run the command again.", input: "command" as const }, shells, hasFiles: this.saved !== null, registration: validateRecord(files) };
      }
      pending = this.password.pending;
      this.clearPassword();
      if (operation.kind === "cancel") {
        const nextShells = structuredClone(shells);
        if (pending.returnDepth) nextShells.splice(pending.returnDepth);
        return { result: { cwd: nextShells.at(-1)!.cwd, output: "", input: "command" as const }, shells: nextShells, hasFiles: this.saved !== null, registration: validateRecord(files) };
      }
    }
    const action = pending ? { kind: "password" as const, pending } : operation?.kind === "save" ? operation : undefined;
    const reply = runConsoleRequest(command, shells, cursor, files, expires - CONSOLE_SESSION_DURATION, action, { principal, migration: principal === "Roseu" ? verifiedRecord(record, files) ?? undefined : undefined });
    if (reply.password) {
      const pending = { id: crypto.randomUUID(), expires: Math.min(Date.now() + 5 * 60 * 1000, expires), principal, pending: reply.password };
      // Persist only the request metadata; entered passwords never reach storage.
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS password_request (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO password_request (id, data) VALUES (1, ?)", JSON.stringify(pending));
      });
      this.password = pending;
      Object.assign(reply.result, { challenge: pending.id });
    }
    const changes = getConsoleChanges(reply.files);
    const after = JSON.stringify(changes);
    let registration = validateRecord(reply.files);
    let registered = false;
    if (reply.registration && getConsoleRecordText(reply.registration.path, reply.files, principal) === reply.registration.text) {
      registration = { path: reply.registration.path, hash: createHash("sha256").update(reply.registration.text).digest("hex") };
      registered = true;
    }
    // Persist only actual file mutations; reads and shell changes have no storage writes.
    if (after !== (this.saved ?? JSON.stringify(this.changes))) {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS changes (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO changes (id, data) VALUES (1, ?)", after);
      });
      this.saved = after;
      this.changes = changes;
    }
    // One fixed workspace alarm also retires metadata from abandoned password requests.
    if ((this.saved !== null || this.password !== null) && !this.alarmScheduled) {
      this.alarmScheduled = true;
      try {
        if (await this.ctx.storage.getAlarm() !== expires) await this.ctx.storage.setAlarm(expires);
      } catch (cause) { this.alarmScheduled = false; throw cause; }
    }
    return { result: reply.result, shells: reply.shells, hasFiles: this.saved !== null || this.password !== null, registration, registered };
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.changes = { version: 1, entries: [] };
    this.saved = null;
    this.alarmScheduled = false;
    this.password = null;
  }

}
