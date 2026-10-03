import type { LoaderFunctionArgs } from "~/framework/http";
import { startAccessLogin } from "~/utils/umigame/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return startAccessLogin(request, context);
}
