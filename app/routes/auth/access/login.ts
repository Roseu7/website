import type { LoaderFunctionArgs } from "~/framework/http";
import { finishAccessLogin } from "~/utils/umigame/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return finishAccessLogin(request, context);
}
