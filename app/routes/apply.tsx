import { Form, useActionData, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { NotFoundBoundary } from "~/components/routing/NotFoundBoundary";
import { PageLayout } from "~/components/layout/PageLayout";

export { NotFoundBoundary as ErrorBoundary };

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

export const meta = () => [
  { title: "Whitelist Application" },
  { name: "description", content: "Minecraftサーバー参加申請" },
  { name: "robots", content: "noindex, nofollow" },
];

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
  const form = await request.formData();
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

export default function ApplyPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ApplyActionData | undefined;

  return (
    <PageLayout contentClassName="dashboard-shell dashboard-shell--narrow">
      <header className="apply-heading">
        <h1 className="apply-heading__title">Whitelist Application</h1>
        <p className="apply-heading__lead">
          招待コードを持っている人だけが申請できます。<br />
          Minecraft IDは正確に入力してください。
        </p>
      </header>

      {!data.authenticated ? (
        <section className="apply-panel">
          <p>申請には指定Discordサーバーへの参加とログインが必要です。</p>
          <a className="btn site-button" href={data.loginUrl}>Discordでログイン</a>
        </section>
      ) : !data.guildMember ? (
        <section className="apply-panel apply-panel--error">
          <div className="apply-identity">
            <div>
              <span>Discord</span>
              <strong>
                {data.discordName}
                {data.discordUsername ? (
                  <small className="apply-discord-username">@{data.discordUsername}</small>
                ) : null}
              </strong>
            </div>
            <Form method="post" action="/auth/logout">
              <input type="hidden" name="returnTo" value="/apply" />
              <button className="apply-logout" type="submit">ログアウト</button>
            </Form>
          </div>
          <h2>Discordサーバーへの参加を確認できません</h2>
          <p>対象サーバーへ参加した後、再度このページを開いてください。</p>
        </section>
      ) : (
        <section className="apply-panel">
          <div className="apply-identity">
            <div>
              <span>Discord</span>
              <strong>
                {data.discordName}
                {data.discordUsername ? (
                  <small className="apply-discord-username">@{data.discordUsername}</small>
                ) : null}
              </strong>
            </div>
            <Form method="post" action="/auth/logout">
              <input type="hidden" name="returnTo" value="/apply" />
              <button className="apply-logout" type="submit">ログアウト</button>
            </Form>
          </div>
          <Form method="post" className="dashboard-link-form">
            <label className="dashboard-field">
              <span className="dashboard-field__label apply-field-label">MINECRAFT ID</span>
              <input
                className="dashboard-field__input input"
                name="minecraftName"
                required
                minLength={3}
                maxLength={16}
                pattern="[A-Za-z0-9_]+"
                inputMode="text"
                autoComplete="off"
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field__label apply-field-label">INVITE CODE</span>
              <input
                className="dashboard-field__input input apply-code-input"
                name="inviteCode"
                required
                minLength={6}
                maxLength={6}
                pattern="[A-Za-z0-9]+"
                inputMode="text"
                autoComplete="off"
              />
            </label>
            <button className="btn site-button" type="submit">申請を送信</button>
          </Form>
        </section>
      )}

      {actionData ? (
        <p className={`apply-result ${actionData.ok ? "apply-result--success" : "apply-result--error"}`}>
          {actionData.message}
        </p>
      ) : null}
    </PageLayout>
  );
}
