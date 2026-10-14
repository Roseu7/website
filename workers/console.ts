import { DurableObject } from "cloudflare:workers";
import { createConsoleState, type ConsoleState } from "../app/utils/console.server";
import { runConsoleRequest } from "../app/utils/console-session.server";
import type { ConsoleShell } from "../app/utils/console";

export class ConsoleSession extends DurableObject<Env> {
  private files: ConsoleState["files"];
  private saved: string | null = null;
  private alarmScheduled = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const tables = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session', 'files')").toArray();
    if (tables.some(row => row.name === "session")) {
      // Migrate the previous format without retaining environment variables or login state.
      const legacy = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM session WHERE id = 1").toArray()[0];
      this.ctx.storage.transactionSync(() => {
        if (legacy) {
          const files = JSON.stringify((JSON.parse(legacy.data) as ConsoleState).files);
          this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
          this.ctx.storage.sql.exec("INSERT OR REPLACE INTO files (id, data) VALUES (1, ?)", files);
        }
        this.ctx.storage.sql.exec("DROP TABLE session");
      });
    }
    const hasTable = this.ctx.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'files'").toArray().length > 0;
    const row = hasTable ? this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM files WHERE id = 1").toArray()[0] : undefined;
    this.saved = row?.data ?? null;
    this.files = row ? JSON.parse(row.data) : createConsoleState().files;
  }

  async run(command: string, shells: ConsoleShell[], cursor: number | null, expires: number) {
    if (expires <= Date.now()) throw Error("Session expired.");
    const before = JSON.stringify(this.files);
    const reply = runConsoleRequest(command, shells, cursor, structuredClone(this.files));
    const after = JSON.stringify(reply.files);
    // Persist only actual file mutations; reads and shell changes have no storage writes.
    if (after !== before) {
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
        this.ctx.storage.sql.exec("INSERT OR REPLACE INTO files (id, data) VALUES (1, ?)", after);
      });
      this.saved = after;
      this.files = reply.files;
    }
    // The fixed expiry requires one alarm per mutated filesystem, not one per command.
    if (this.saved !== null && !this.alarmScheduled) {
      this.alarmScheduled = true;
      try {
        if (await this.ctx.storage.getAlarm() !== expires) await this.ctx.storage.setAlarm(expires);
      } catch (cause) { this.alarmScheduled = false; throw cause; }
    }
    return { result: reply.result, shells: reply.shells, hasFiles: this.saved !== null };
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.files = createConsoleState().files;
    this.saved = null;
    this.alarmScheduled = false;
  }
}
