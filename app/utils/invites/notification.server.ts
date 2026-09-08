import type { InviteApplication } from "~/utils/invites/db.server";

export function buildInviteNotification(application: InviteApplication, reviewerName?: string) {
  const status = application.status === "approved"
    ? "**承認済み**"
    : application.status === "denied"
      ? "**拒否済み**"
      : "`承認待ち`";
  return [
    `**Whitelist申請 #${application.id}**`,
    `**状態**: ${status}`,
    `**Minecraft**: \`${application.minecraftName}\``,
    `**Discord**: ${application.discordDisplayName} (\`${application.discordId}\`)`,
    `**招待者**: \`${application.inviterName}\``,
    ...(application.verificationStatus === "unverified" ? ["**照会**: 未確認（承認時にサーバー側で再確認）"] : []),
    ...(application.reviewNote ? ["**詳細**", `> ${application.reviewNote}`] : []),
    ...(reviewerName ? [`**処理者**: ${reviewerName}`] : []),
  ].join("\n");
}

export function inviteReviewComponents(application: InviteApplication): unknown[] | undefined {
  if (application.status !== "pending") return undefined;
  return [{
    type: 1,
    components: [
      { type: 2, style: 3, label: "承認", custom_id: `invite:approve:${application.id}` },
      { type: 2, style: 4, label: "拒否", custom_id: `invite:deny:${application.id}` },
    ],
  }];
}
