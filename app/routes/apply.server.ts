import { type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

interface ApplyLoaderData {
  authenticated: boolean;
  guildMember: boolean;
  discordName: string | null;
  discordUsername: string | null;
  loginUrl: string;
}

interface ApplyActionData {
  ok?: boolean;
  message: string;
  applicationId?: number;
}

export async function loader({ request, context }: LoaderFunctionArgs): Promise<ApplyLoaderData> {
  const [
    { requireMcDashboardHost },
    { getMcSession },
    { getMcDashboardEnv, requireNikoServerDiscordGuildId },
    { getDiscordUser },
    { listManagedServers },
    { isDiscordGuildMemberOfAny },
  ] = await Promise.all([
    import("~/utils/mc/host"),
    import("~/utils/mc/session.server"),
    import("~/utils/mc/env.server"),
    import("~/utils/mc/db.server"),
    import("~/utils/invites/db.server"),
    import("~/utils/invites/discord.server"),
  ]);
  requireMcDashboardHost(request);
  const session = await getMcSession(request, context);
  const discordId = session.get("discordUserId");
  if (!discordId) {
    return {
      authenticated: false,
      guildMember: false,
      discordName: null,
      discordUsername: null,
      loginUrl: "/auth/discord/start?returnTo=%2Fapply",
    };
  }
  const env = getMcDashboardEnv(context);
  const servers = await listManagedServers(env.DB, requireNikoServerDiscordGuildId(env));
  const [user, guildMember] = await Promise.all([
    getDiscordUser(env.DB, discordId),
    isDiscordGuildMemberOfAny(context, discordId, servers.map((server) => server.discordGuildId)),
  ]);
  return {
    authenticated: Boolean(user),
    guildMember,
    discordName: user?.globalName ?? user?.username ?? null,
    discordUsername: user?.username ?? null,
    loginUrl: "/auth/discord/start?returnTo=%2Fapply",
  };
}

export async function action({ request, context }: ActionFunctionArgs): Promise<ApplyActionData> {
  const [
    { requireMcDashboardHost, requireMcMutationOrigin },
    { getMcSession },
    { getMcDashboardEnv, requireNikoServerDiscordGuildId },
    { createWhitelistApplication, ensureDefaultManagedServer, getAdminNotificationDiscordIds, getApplicationById, getInviteServer, recordDiscordNotification },
    { isDiscordGuildMember, resolveMinecraftProfile, sendDiscordDm },
    { buildInviteNotification, inviteReviewComponents },
  ] = await Promise.all([
    import("~/utils/mc/host"),
    import("~/utils/mc/session.server"),
    import("~/utils/mc/env.server"),
    import("~/utils/invites/db.server"),
    import("~/utils/invites/discord.server"),
    import("~/utils/invites/notification.server"),
  ]);
  requireMcDashboardHost(request);
  requireMcMutationOrigin(request);
  const session = await getMcSession(request, context);
  const discordId = session.get("discordUserId");
  if (!discordId) {
    return { message: "先にDiscordへログインしてください。" };
  }
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const minecraftName = form.get("minecraftName");
  const inviteCode = form.get("inviteCode");
  if (typeof minecraftName !== "string" || typeof inviteCode !== "string") {
    return { message: "入力内容が不正です。" };
  }
  const normalizedMinecraftName = minecraftName.trim();
  const normalizedInviteCode = inviteCode.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(normalizedMinecraftName)) {
    return { message: "Minecraft IDは3から16文字の英数字またはアンダーバーで入力してください。" };
  }
  if (!/^[A-Za-z0-9]{6}$/.test(normalizedInviteCode)) {
    return { message: "招待コードは6文字の英数字で入力してください。" };
  }
  const env = getMcDashboardEnv(context);
  await ensureDefaultManagedServer(env.DB, requireNikoServerDiscordGuildId(env));
  const targetServer = await getInviteServer(env.DB, normalizedInviteCode);
  if (!targetServer) {
    return { message: "招待コードが無効、または期限切れです。" };
  }
  if (!await isDiscordGuildMember(context, discordId, targetServer.discordGuildId)) {
    return { message: "この招待コードの対象Discordサーバーへの参加が必要です。" };
  }
  const profileResult = await resolveMinecraftProfile(normalizedMinecraftName);
  if (profileResult.status === "not_found") {
    return { message: "Minecraft IDを確認できませんでした。" };
  }
  const profile = profileResult.profile;
  const result = await createWhitelistApplication(env.DB, {
    serverId: targetServer.serverId,
    minecraftUuid: profile.uuid,
    minecraftName: profile.name,
    discordId,
    inviteCode: normalizedInviteCode,
    verificationStatus: profileResult.status === "unverified" ? "unverified" : "verified",
    verificationSource: profileResult.status === "unverified" ? "unverified" : profileResult.source,
  });
  if (!result.ok) {
    return { message: result.message };
  }
  const application = await getApplicationById(env.DB, result.id);

  if (!application) {
    return { message: "申請の保存確認に失敗しました。" };
  }
  const notification = buildInviteNotification(application);
  const reviewComponents = inviteReviewComponents(application);
  const adminDiscordIds = await getAdminNotificationDiscordIds(env.DB, targetServer.serverId);
  context.cloudflare.ctx.waitUntil(
    Promise.allSettled(
      adminDiscordIds.map(async (adminDiscordId) => {
        const sent = await sendDiscordDm(context, adminDiscordId, notification, reviewComponents);
        if (sent) await recordDiscordNotification(env.DB, { applicationId: result.id, discordId: adminDiscordId, ...sent });
      })
    )
  );
  return {
    ok: true,
    applicationId: result.id,
    message: result.status === "approved"
      ? "申請を受け付け、自動承認しました。サーバー反映まで少しお待ちください。"
      : "申請を受け付けました。管理者の承認をお待ちください。",
  };
}
