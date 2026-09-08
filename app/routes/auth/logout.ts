import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { safeReturnTo } from "~/utils/return-to";

export async function loader({ request }: LoaderFunctionArgs) {
  const { requireMcDashboardHost } = await import("~/utils/mc/host");
  requireMcDashboardHost(request);
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [{ requireMcDashboardHost, requireMcMutationOrigin }, { getMcSession, destroyMcSession }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
    ]);

  requireMcDashboardHost(request);
  requireMcMutationOrigin(request);

  const session = await getMcSession(request, context);
  const form = await request.formData();
  const returnTo = form.get("returnTo");
  const redirectTo = safeReturnTo(returnTo);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await destroyMcSession(session, context),
      "Cache-Control": "no-store",
    },
  });
}
