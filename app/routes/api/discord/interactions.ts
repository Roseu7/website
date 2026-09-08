import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type DiscordInteraction = {
  type?: number;
  data?: {
    custom_id?: string;
  };
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
  member?: {
    user?: {
      id?: string;
      username?: string;
      global_name?: string | null;
    };
  };
};

export async function loader(_: LoaderFunctionArgs) {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", { status: 405 });
  }

  const [{ getMcDashboardEnv, requireMcEnvValue }, { getAdminDiscordIds, getApplicationById, listDiscordNotifications, reviewApplication }, { editDiscordDm }, { buildInviteNotification }] =
    await Promise.all([
      import("~/utils/mc/env.server"),
      import("~/utils/invites/db.server"),
      import("~/utils/invites/discord.server"),
      import("~/utils/invites/notification.server"),
    ]);
  const env = getMcDashboardEnv(context);
  const bodyText = await request.text();
  const verified = await verifyDiscordSignature(
    request,
    bodyText,
    requireMcEnvValue(env, "SURVCORE_DISCORD_PUBLIC_KEY")
  );
  if (!verified) {
    throw new Response("Invalid request signature.", { status: 401 });
  }

  const interaction = JSON.parse(bodyText) as DiscordInteraction;
  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }
  if (interaction.type !== 3) {
    return discordMessage("この操作には対応していません。", true);
  }

  const customId = interaction.data?.custom_id ?? "";
  const match = /^invite:(approve|deny):(\d+)$/.exec(customId);
  if (!match) {
    return discordMessage("不明な操作です。", true);
  }

  const actor = interaction.member?.user ?? interaction.user;
  const discordId = actor?.id;
  if (!discordId) {
    return discordMessage("Discordユーザーを確認できませんでした。", true);
  }
  const approve = match[1] === "approve";
  const applicationId = Number(match[2]);
  const reviewerName = actor?.global_name ?? actor?.username ?? discordId;
  const application = await getApplicationById(env.DB, applicationId);
  if (!application) {
    return discordMessage("申請が見つかりません。", true);
  }
  const adminDiscordIds = new Set(await getAdminDiscordIds(env.DB, application.serverId));
  const ownerDiscordId = env.SURVCORE_OWNER_DISCORD_ID;
  if (discordId !== ownerDiscordId && !adminDiscordIds.has(discordId)) {
    return discordMessage("この申請を処理する権限がありません。", true);
  }
  const updated = await reviewApplication(env.DB, {
    serverId: application.serverId,
    id: applicationId,
    approve,
    reviewerUuid: `discord:${discordId}`,
    reviewerName,
    note: "Discord DMから処理",
  });
  if (!updated) {
    return discordMessage("申請が見つからないか、既に処理されています。", true);
  }

  const updatedApplication = await getApplicationById(env.DB, applicationId);
  if (!updatedApplication) {
    return discordMessage("申請の更新確認に失敗しました。", true);
  }
  const content = buildInviteNotification(updatedApplication, reviewerName);
  context.cloudflare.ctx.waitUntil(
    listDiscordNotifications(env.DB, applicationId).then((notifications) => Promise.allSettled(
      notifications.filter((notification) => notification.discordId !== discordId)
        .map((notification) => editDiscordDm(context, notification.channelId, notification.messageId, content))
    ))
  );

  return Response.json({
    type: 7,
    data: {
      content,
      components: [],
    },
  });
}

function discordMessage(content: string, ephemeral: boolean) {
  return Response.json({
    type: 4,
    data: {
      content,
      ...(ephemeral ? { flags: 64 } : {}),
    },
  });
}

async function verifyDiscordSignature(request: Request, bodyText: string, publicKeyHex: string) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) {
    return false;
  }
  const keyBytes = hexToBytes(publicKeyHex);
  const signatureBytes = hexToBytes(signature);
  const data = new TextEncoder().encode(timestamp + bodyText);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "Ed25519" } as Algorithm,
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    { name: "Ed25519" } as Algorithm,
    key,
    signatureBytes,
    data
  );
}

function hexToBytes(hex: string) {
  const normalized = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Response("Invalid hex value.", { status: 400 });
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}
