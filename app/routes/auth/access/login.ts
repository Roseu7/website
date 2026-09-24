import type { LoaderFunctionArgs } from "react-router";
import { finishAccessLogin } from "~/utils/umigame/auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return finishAccessLogin(request, context);
}
