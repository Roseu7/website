import { openConsole } from "~/utils/console.server";
import { data } from "~/framework/http";

export function loader() { return data(openConsole(), { headers: { "Cache-Control": "no-store" } }); }
