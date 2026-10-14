import { DurableObject } from "cloudflare:workers";
import { createConsoleState, executeConsole, completeConsole, type ConsoleState } from "../app/utils/console.server";

export class ConsoleSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)");
  }

  async run(command: string, cursor: number | null, expires: number) {
    const row = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM session WHERE id = 1").toArray()[0];
    const state: ConsoleState = row ? JSON.parse(row.data) : createConsoleState();
    // SQL access and command processing stay synchronous so concurrent requests cannot lose updates.
    const reply = cursor === null ? executeConsole(command, state) : completeConsole(command, state, cursor);
    if (cursor === null) this.ctx.storage.sql.exec("INSERT OR REPLACE INTO session (id, data) VALUES (1, ?)", JSON.stringify(state));
    await this.ctx.storage.setAlarm(expires);
    return reply;
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}
