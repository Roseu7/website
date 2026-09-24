import type { AppLoadContext } from "react-router";
import type { McDashboardEnv } from "~/utils/mc/env.server";
import { requireStrings, type ServiceBody } from "~/utils/smanage/payload.server";

type InviteDb = typeof import("~/utils/invites/db.server");

interface SManageOperationContext {
  body: ServiceBody;
  context: AppLoadContext;
  env: McDashboardEnv;
  inviteDb: InviteDb;
  serverId: string;
}

export async function handleSManageOperation({
  body,
  context,
  env,
  inviteDb,
  serverId,
}: SManageOperationContext): Promise<Response> {
  const operation = body.operation;

  if (operation === "register_code") {
    requireStrings(body, ["code", "issuerUuid", "issuerName", "expiresAt"]);
    await inviteDb.registerInviteCode(env.DB, {
      serverId,
      code: body.code as string,
      issuerUuid: body.issuerUuid as string,
      issuerName: body.issuerName as string,
      expiresAt: body.expiresAt as string,
    });
    return Response.json({ ok: true });
  }

  if (operation === "list") {
    const page = typeof body.page === "number" ? Math.max(1, Math.floor(body.page)) : 1;
    return Response.json(await inviteDb.listPendingApplications(env.DB, serverId, page, 10));
  }

  if (operation === "review") {
    requireStrings(body, ["reviewerUuid", "reviewerName"]);
    if (typeof body.id !== "number" || typeof body.approve !== "boolean") {
      throw new Response("Invalid review payload.", { status: 400 });
    }
    const updated = await inviteDb.reviewApplication(env.DB, {
      serverId,
      id: Math.floor(body.id),
      approve: body.approve,
      reviewerUuid: body.reviewerUuid as string,
      reviewerName: body.reviewerName as string,
      note: typeof body.note === "string" ? body.note : undefined,
      gameNotified: typeof body.gameNotified === "boolean" ? body.gameNotified : undefined,
    });
    const application = updated ? await inviteDb.getApplicationById(env.DB, Math.floor(body.id)) : null;
    if (application) {
      const [{ editDiscordDm }, { buildInviteNotification }] = await Promise.all([
        import("~/utils/invites/discord.server"),
        import("~/utils/invites/notification.server"),
      ]);
      const content = buildInviteNotification(application, body.reviewerName as string);
      context.cloudflare.ctx.waitUntil(
        inviteDb.listDiscordNotifications(env.DB, application.id).then((notifications) => Promise.allSettled(
          notifications.map((notification) => editDiscordDm(context, notification.channelId, notification.messageId, content))
        ))
      );
    }
    return Response.json({
      ok: updated,
      application,
    });
  }

  if (operation === "mode") {
    if (body.mode !== "manual" && body.mode !== "auto") {
      throw new Response("Invalid invite mode.", { status: 400 });
    }
    await inviteDb.setInviteMode(env.DB, serverId, body.mode);
    return Response.json({ ok: true, mode: body.mode });
  }

  if (operation === "dm") {
    requireStrings(body, ["minecraftUuid"]);
    if (typeof body.enabled !== "boolean") {
      throw new Response("Invalid invite DM setting.", { status: 400 });
    }
    const updated = await inviteDb.setInviteDmEnabled(
      env.DB,
      serverId,
      body.minecraftUuid as string,
      body.enabled
    );
    if (!updated) {
      throw new Response("Admin setting was not found.", { status: 403 });
    }
    return Response.json({ ok: true, enabled: body.enabled });
  }

  if (operation === "history") {
    const page = typeof body.page === "number" ? Math.max(1, Math.floor(body.page)) : 1;
    const status = body.status === "approved" || body.status === "denied"
      ? body.status
      : undefined;
    return Response.json(await inviteDb.listApplicationHistory(env.DB, serverId, page, status, 10));
  }

  if (operation === "reset") {
    await inviteDb.resetInviteData(env.DB, serverId);
    return Response.json({ ok: true });
  }

  if (operation === "sync_admin") {
    requireStrings(body, ["minecraftUuid", "minecraftName", "role"]);
    if ((body.role !== "owner" && body.role !== "admin") || typeof body.active !== "boolean") {
      throw new Response("Invalid admin payload.", { status: 400 });
    }
    await inviteDb.syncAdmin(env.DB, {
      serverId,
      minecraftUuid: body.minecraftUuid as string,
      minecraftName: body.minecraftName as string,
      role: body.role,
      active: body.active,
    });
    return Response.json({ ok: true });
  }

  if (operation === "sync_whitelist") {
    const acknowledged = Array.isArray(body.acknowledgedIds)
      ? body.acknowledgedIds.filter((id): id is number => typeof id === "number")
      : [];
    await inviteDb.markWhitelistSynced(env.DB, serverId, acknowledged);
    return Response.json({ applications: await inviteDb.listUnsyncedApproved(env.DB, serverId) });
  }

  if (operation === "confirm_profile") {
    requireStrings(body, ["minecraftUuid", "minecraftName"]);
    if (typeof body.id !== "number") {
      throw new Response("Invalid profile confirmation payload.", { status: 400 });
    }
    return Response.json({
      ok: await inviteDb.confirmApplicationMinecraftProfile(env.DB, {
        serverId,
        id: Math.floor(body.id),
        minecraftUuid: body.minecraftUuid as string,
        minecraftName: body.minecraftName as string,
      }),
    });
  }

  if (operation === "review_events") {
    const acknowledged = Array.isArray(body.acknowledgedIds)
      ? body.acknowledgedIds.filter((id): id is number => typeof id === "number")
      : [];
    return Response.json({ events: await inviteDb.listUnnotifiedReviewEvents(env.DB, serverId, acknowledged) });
  }

  if (operation === "trust") {
    requireStrings(body, ["minecraftUuid", "minecraftName", "state"]);
    await inviteDb.updateTrust(env.DB, {
      serverId,
      minecraftUuid: body.minecraftUuid as string,
      minecraftName: body.minecraftName as string,
      state: body.state as string,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });
    return Response.json({ ok: true });
  }

  throw new Response("Unknown operation.", { status: 400 });
}
