import { openConsole } from "~/utils/console.server";
import { data } from "~/framework/http";
import { signConsoleSession } from "~/utils/console-session.server";
import type { LoaderFunctionArgs } from "~/framework/http";

export async function loader({ context }: LoaderFunctionArgs) {
  const initial = openConsole();
  const proof = await signConsoleSession(initial.sessionId, false, context.cloudflare.env.CONSOLE_SESSION_SECRET);
  return data({ ...initial, proof }, { headers: { "Cache-Control": "no-store" } });
}
