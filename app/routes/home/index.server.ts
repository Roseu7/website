
import { type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import type { McDashboardLoaderData } from "~/utils/mc/dashboard";

import { isCanonicalHomeControlHost } from "~/utils/home/host";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { isMcDashboardHost } from "~/utils/host-config";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { hostname } = new URL(request.url);
  const isHomeControlHost = isCanonicalHomeControlHost(hostname);
  const isMcHost = isMcDashboardHost(hostname);

  return {
    isHomeControlHost,
    isMcDashboardHost: isMcHost,
    mcDashboardData: isMcHost ? await loadMcDashboardData(request, context) : null,
  };
}

async function loadMcDashboardData(
  request: Request,
  context: LoaderFunctionArgs["context"]
): Promise<McDashboardLoaderData> {
  const [{ formatMcCheckedAt, isMcServerOnline }, { requireMcDashboardHost }, { getMcSession }, { getMcDashboardEnv, requireOwnerDiscordUser }, { getActiveMinecraftLink, getDiscordUser, getServerState }] =
    await Promise.all([
      import("~/utils/mc/dashboard"),
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
    ]);

  requireMcDashboardHost(request);

  const session = await getMcSession(request, context);
  const discordUserId = session.get("discordUserId");
  const env = getMcDashboardEnv(context);
  const url = new URL(request.url);
  const serverState = await getServerState(env.DB);
  const serverOnline = serverState
    ? isMcServerOnline(serverState.checkedAt, serverState.online)
    : false;
  const checkedAtLabel = serverState
    ? formatMcCheckedAt(serverState.checkedAt)
    : "-";

  if (!discordUserId) {
    return {
      isAuthenticated: false,
      discordUser: null,
      minecraftLink: null,
      serverState,
      serverOnline,
      checkedAtLabel,
      loginUrl: "/auth/discord/start",
      notice:
        url.searchParams.get("linked") === "1"
          ? "アカウントの紐づけが完了しました。"
          : url.searchParams.get("map") === "offline"
            ? "サーバーがオフラインのため、Server Map は現在利用できません。"
            : null,
    };
  }
  requireOwnerDiscordUser(env, discordUserId);

  const [discordUser, minecraftLink] = await Promise.all([
    getDiscordUser(env.DB, discordUserId),
    getActiveMinecraftLink(env.DB, discordUserId),
  ]);

  return {
    isAuthenticated: Boolean(discordUser),
    discordUser,
    minecraftLink,
    serverState,
    serverOnline,
    checkedAtLabel,
    loginUrl: "/auth/discord/start",
    notice:
      url.searchParams.get("linked") === "1"
        ? "アカウントの紐づけが完了しました。"
        : url.searchParams.get("map") === "offline"
          ? "サーバーがオフラインのため、Server Map は現在利用できません。"
          : null,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { hostname } = new URL(request.url);
  if (!isMcDashboardHost(hostname)) {
    throw new Response("Not Found", { status: 404 });
  }

  const [{ requireMcMutationOrigin }, { getMcSession }, { getMcDashboardEnv }, { consumeLinkCodeAndLinkDiscord }] =
    await Promise.all([
      import("~/utils/mc/host"),
      import("~/utils/mc/session.server"),
      import("~/utils/mc/env.server"),
      import("~/utils/mc/db.server"),
    ]);

  requireMcMutationOrigin(request);

  const formData = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const intent = formData.get("intent");
  if (intent !== "link-code") {
    throw new Response("Bad Request", { status: 400 });
  }

  const session = await getMcSession(request, context);
  const discordUserId = session.get("discordUserId");
  if (!discordUserId) {
    return Response.json({ linkError: "先に Discord へログインしてください。" }, { status: 401 });
  }

  const code = formData.get("code");
  if (typeof code !== "string" || code.trim().length === 0) {
    return Response.json({ linkError: "リンクコードを入力してください。" }, { status: 400 });
  }

  const env = getMcDashboardEnv(context);
  const result = await consumeLinkCodeAndLinkDiscord(env.DB, discordUserId, code);
  if (!result.ok) {
    return Response.json({ linkError: result.message }, { status: 400 });
  }

  return Response.redirect("/?linked=1", 302);
}
