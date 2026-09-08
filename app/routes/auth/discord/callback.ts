import { redirect, type LoaderFunctionArgs } from "react-router";
import { safeReturnTo } from "~/utils/return-to";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const [{ requireMcDashboardHost }, { getMcSession, commitMcSession }, { exchangeDiscordCode, fetchDiscordUser }, { getMcDashboardEnv }, { upsertDiscordUser }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/oauth.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
    ]);

  requireMcDashboardHost(request);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return redirect("/");
  }

  if (!code || !state) {
    throw new Response("Invalid Discord callback.", { status: 400 });
  }

  const session = await getMcSession(request, context);
  const expectedState = session.get("discordOauthState");
  if (!expectedState || expectedState !== state) {
    throw new Response("Invalid OAuth state.", { status: 400 });
  }

  const accessToken = await exchangeDiscordCode(context, code);
  const discordUser = await fetchDiscordUser(accessToken);
  const env = getMcDashboardEnv(context);
  await upsertDiscordUser(env.DB, {
    discordId: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name,
    avatarHash: discordUser.avatar,
  });

  session.unset("discordOauthState");
  session.set("discordUserId", discordUser.id);
  const returnTo = safeReturnTo(session.get("discordReturnTo"));
  session.unset("discordReturnTo");

  return redirect(returnTo, {
    headers: {
      "Set-Cookie": await commitMcSession(session, context),
      "Cache-Control": "no-store",
    },
  });
}
