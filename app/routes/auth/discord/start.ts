import { redirect, type LoaderFunctionArgs } from "react-router";
import { safeReturnTo } from "~/utils/return-to";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const [{ requireMcDashboardHost }, { createDiscordLoginUrl }, { commitMcSession, getMcSession }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/oauth.server"),
      import("~/utils/mc/session.server"),
    ]);

  requireMcDashboardHost(request);

  const session = await getMcSession(request, context);
  const state = crypto.randomUUID();
  const returnTo = new URL(request.url).searchParams.get("returnTo");
  session.set("discordOauthState", state);
  session.set("discordReturnTo", safeReturnTo(returnTo));

  return redirect(createDiscordLoginUrl(context, state), {
    headers: {
      "Set-Cookie": await commitMcSession(session, context),
      "Cache-Control": "no-store",
    },
  });
}
