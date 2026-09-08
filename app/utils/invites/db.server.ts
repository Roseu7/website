import { ensureSchemaCompatibility } from "~/utils/mc/db.server";

export const DEFAULT_SERVER_ID = "nikoserver";

export interface ManagedServer {
  serverId: string;
  displayName: string;
  discordGuildId: string;
}

export interface InviteApplication {
  id: number;
  serverId: string;
  minecraftUuid: string;
  minecraftName: string;
  discordId: string;
  discordDisplayName: string;
  inviteCode: string;
  inviterUuid: string;
  inviterName: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  reviewNote: string | null;
  verificationStatus: "verified" | "unverified";
  verificationSource: string;
}

export interface InviteReviewEvent {
  id: number;
  applicationId: number;
  minecraftName: string;
  discordId: string;
  discordDisplayName: string;
  status: "approved" | "denied";
  reviewerName: string;
  createdAt: string;
}

export interface DiscordNotification {
  discordId: string;
  channelId: string;
  messageId: string;
}

interface ApplicationRow {
  id: number;
  server_id: string;
  minecraft_uuid: string;
  minecraft_name: string;
  discord_id: string;
  discord_display_name: string | null;
  invite_code: string;
  inviter_uuid: string;
  inviter_name: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  review_note: string | null;
  verification_status: "verified" | "unverified";
  verification_source: string;
}

interface ReviewEventRow {
  id: number;
  application_id: number;
  minecraft_name: string;
  discord_id: string;
  discord_display_name: string | null;
  status: "approved" | "denied";
  reviewer_name: string;
  created_at: string;
}

interface TrustRow {
  server_id: string;
  state: string;
  reason: string | null;
}

interface ServerRow {
  server_id: string;
  display_name: string;
  discord_guild_id: string;
}

function mapServer(row: ServerRow): ManagedServer {
  return {
    serverId: row.server_id,
    displayName: row.display_name,
    discordGuildId: row.discord_guild_id,
  };
}

function mapApplication(row: ApplicationRow): InviteApplication {
  return {
    id: row.id,
    serverId: row.server_id,
    minecraftUuid: row.minecraft_uuid,
    minecraftName: row.minecraft_name,
    discordId: row.discord_id,
    discordDisplayName: row.discord_display_name ?? row.discord_id,
    inviteCode: row.invite_code,
    inviterUuid: row.inviter_uuid,
    inviterName: row.inviter_name,
    status: row.status,
    createdAt: row.created_at,
    reviewNote: row.review_note,
    verificationStatus: row.verification_status,
    verificationSource: row.verification_source,
  };
}

function mapReviewEvent(row: ReviewEventRow): InviteReviewEvent {
  return {
    id: row.id,
    applicationId: row.application_id,
    minecraftName: row.minecraft_name,
    discordId: row.discord_id,
    discordDisplayName: row.discord_display_name ?? row.discord_id,
    status: row.status,
    reviewerName: row.reviewer_name,
    createdAt: row.created_at,
  };
}

export async function ensureInviteSchema(db: D1Database) {
  await ensureSchemaCompatibility(db);
}

export async function ensureDefaultManagedServer(db: D1Database, discordGuildId: string) {
  await ensureInviteSchema(db);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO managed_servers(server_id, display_name, discord_guild_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(server_id) DO UPDATE SET
       discord_guild_id = CASE WHEN excluded.discord_guild_id <> '' THEN excluded.discord_guild_id ELSE managed_servers.discord_guild_id END,
       updated_at = excluded.updated_at`
  ).bind(DEFAULT_SERVER_ID, "Niko Server", discordGuildId, now, now).run();
}

export async function listManagedServers(db: D1Database, legacyGuildId: string) {
  await ensureDefaultManagedServer(db, legacyGuildId);
  const rows = await db.prepare(
    `SELECT server_id, display_name, discord_guild_id
     FROM managed_servers WHERE enabled = 1 AND discord_guild_id <> '' ORDER BY server_id`
  ).all<ServerRow>();
  return (rows.results ?? []).map(mapServer);
}

export async function getManagedServer(db: D1Database, serverId: string) {
  await ensureInviteSchema(db);
  const row = await db.prepare(
    `SELECT server_id, display_name, discord_guild_id
     FROM managed_servers WHERE server_id = ? AND enabled = 1 LIMIT 1`
  ).bind(serverId).first<ServerRow>();
  return row ? mapServer(row) : null;
}

export async function getInviteServer(db: D1Database, code: string) {
  await ensureInviteSchema(db);
  const row = await db.prepare(
    `SELECT servers.server_id, servers.display_name, servers.discord_guild_id
     FROM invite_codes AS codes
     INNER JOIN managed_servers AS servers ON servers.server_id = codes.server_id
     WHERE codes.code = ? AND codes.active = 1 AND codes.expires_at > ? AND servers.enabled = 1
     LIMIT 1`
  ).bind(code.trim().toUpperCase(), new Date().toISOString()).first<ServerRow>();
  return row ? mapServer(row) : null;
}

export async function registerInviteCode(
  db: D1Database,
  input: { serverId: string; code: string; issuerUuid: string; issuerName: string; expiresAt: string }
) {
  await ensureInviteSchema(db);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE invite_codes SET active = 0 WHERE server_id = ? AND issuer_uuid = ? AND active = 1")
      .bind(input.serverId, input.issuerUuid),
    db.prepare(
      `INSERT INTO invite_codes(code, server_id, issuer_uuid, issuer_name, created_at, expires_at, active, used_count)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)
       ON CONFLICT(code) DO UPDATE SET server_id = excluded.server_id,
         issuer_uuid = excluded.issuer_uuid, issuer_name = excluded.issuer_name,
         created_at = excluded.created_at, expires_at = excluded.expires_at, active = 1, used_count = 0`
    ).bind(input.code.toUpperCase(), input.serverId, input.issuerUuid, input.issuerName, now, input.expiresAt),
  ]);
}

export async function getInviteMode(db: D1Database, serverId: string) {
  await ensureInviteSchema(db);
  const row = await db.prepare(
    "SELECT setting_value FROM smanage_settings WHERE server_id = ? AND setting_key = 'invite_mode'"
  ).bind(serverId).first<{ setting_value: string }>();
  return row?.setting_value === "auto" ? "auto" : "manual";
}

export async function setInviteMode(db: D1Database, serverId: string, mode: "manual" | "auto") {
  await setSetting(db, serverId, "invite_mode", mode);
}

export async function setInviteDmEnabled(
  db: D1Database,
  serverId: string,
  minecraftUuid: string,
  enabled: boolean
) {
  await ensureInviteSchema(db);
  const result = await db.prepare(
    `INSERT INTO smanage_admin_dm_settings(server_id, minecraft_uuid, enabled, updated_at)
     SELECT ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM smanage_admins
       WHERE server_id = ? AND minecraft_uuid = ? AND active = 1
     )
     ON CONFLICT(server_id, minecraft_uuid) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  ).bind(serverId, minecraftUuid, enabled ? 1 : 0, new Date().toISOString(), serverId, minecraftUuid).run();
  return (result.meta.changes ?? 0) > 0;
}

async function setSetting(db: D1Database, serverId: string, key: string, value: string) {
  await ensureInviteSchema(db);
  await db.prepare(
    `INSERT INTO smanage_settings(server_id, setting_key, setting_value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(server_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`
  ).bind(serverId, key, value, new Date().toISOString()).run();
}

export async function createWhitelistApplication(
  db: D1Database,
  input: { serverId: string; minecraftUuid: string; minecraftName: string; discordId: string; inviteCode: string; verificationStatus: "verified" | "unverified"; verificationSource: string }
) {
  await ensureInviteSchema(db);
  const code = input.inviteCode.trim().toUpperCase();
  const invite = await db.prepare(
    `SELECT server_id, issuer_uuid, issuer_name, expires_at, active
     FROM invite_codes WHERE code = ? LIMIT 1`
  ).bind(code).first<{ server_id: string; issuer_uuid: string; issuer_name: string; expires_at: string; active: number }>();
  if (!invite || invite.server_id !== input.serverId || invite.active !== 1 || new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, message: "招待コードが無効、または期限切れです。" };
  }

  const [existing, approved, localTrust, crossTrust, crossDenied, recent] = await Promise.all([
    db.prepare("SELECT 1 FROM whitelist_applications WHERE server_id = ? AND minecraft_uuid = ? AND status = 'pending' LIMIT 1")
      .bind(input.serverId, input.minecraftUuid).first(),
    db.prepare("SELECT 1 FROM whitelist_applications WHERE server_id = ? AND minecraft_uuid = ? AND status = 'approved' LIMIT 1")
      .bind(input.serverId, input.minecraftUuid).first(),
    db.prepare("SELECT server_id, state, reason FROM whitelist_trust WHERE server_id = ? AND minecraft_uuid = ?")
      .bind(input.serverId, input.minecraftUuid).first<TrustRow>(),
    db.prepare("SELECT trust.server_id, trust.state, trust.reason FROM whitelist_trust AS trust WHERE trust.minecraft_uuid = ? AND trust.server_id <> ? AND trust.state IN ('manual_required', 'blocked') ORDER BY trust.updated_at DESC LIMIT 1")
      .bind(input.minecraftUuid, input.serverId).first<TrustRow>(),
    db.prepare("SELECT applications.server_id, servers.display_name, applications.review_note FROM whitelist_applications AS applications INNER JOIN managed_servers AS servers ON servers.server_id = applications.server_id WHERE applications.minecraft_uuid = ? AND applications.server_id <> ? AND applications.status = 'denied' ORDER BY applications.created_at DESC LIMIT 1")
      .bind(input.minecraftUuid, input.serverId).first<{ server_id: string; display_name: string; review_note: string | null }>(),
    db.prepare("SELECT COUNT(*) AS count FROM whitelist_applications WHERE discord_id = ? AND created_at >= ?")
      .bind(input.discordId, new Date(Date.now() - 60 * 60 * 1000).toISOString()).first<{ count: number }>(),
  ]);
  if (existing) return { ok: false as const, message: "このMinecraftアカウントは既に申請中です。" };
  if (approved && localTrust?.state !== "manual_required" && localTrust?.state !== "blocked") {
    return { ok: false as const, message: "このMinecraftアカウントは既に承認されています。" };
  }
  if (localTrust?.state === "blocked") {
    return { ok: false as const, message: "このMinecraftアカウントは申請できません。" };
  }
  if ((recent?.count ?? 0) >= 5) return { ok: false as const, message: "短時間の申請回数が上限に達しています。" };

  const inviterTrust = await db.prepare(
    "SELECT server_id, state, reason FROM whitelist_trust WHERE server_id = ? AND minecraft_uuid = ?"
  ).bind(input.serverId, invite.issuer_uuid).first<TrustRow>();
  const requiresManual = input.verificationStatus === "unverified"
    || localTrust?.state === "manual_required"
    || crossTrust != null
    || crossDenied != null
    || inviterTrust?.state === "blocked";
  const mode = await getInviteMode(db, input.serverId);
  const reviewNote = buildManualReviewNote({ localTrust, crossTrust, crossDenied, inviterTrust, inviterName: invite.issuer_name, verificationStatus: input.verificationStatus });
  const status = mode === "auto" && !requiresManual ? "approved" : "pending";
  const now = new Date().toISOString();
  const result = await db.prepare(
    `INSERT INTO whitelist_applications(
      server_id, minecraft_uuid, minecraft_name, discord_id, invite_code, inviter_uuid, inviter_name,
      status, mode_at_submission, created_at, reviewed_at, reviewed_by_name, review_note, whitelist_synced,
      verification_status, verification_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    input.serverId, input.minecraftUuid, input.minecraftName, input.discordId, code, invite.issuer_uuid, invite.issuer_name,
    status, mode, now, status === "approved" ? now : null, status === "approved" ? "AUTO" : null,
    requiresManual ? reviewNote : null, input.verificationStatus, input.verificationSource
  ).run();
  await db.batch([
    db.prepare("UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND server_id = ?").bind(code, input.serverId),
    db.prepare(`INSERT INTO smanage_discord_links(minecraft_uuid, minecraft_name, discord_id, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(minecraft_uuid) DO UPDATE SET minecraft_name = excluded.minecraft_name, discord_id = excluded.discord_id, updated_at = excluded.updated_at`)
      .bind(input.minecraftUuid, input.minecraftName, input.discordId, now),
  ]);
  return { ok: true as const, id: Number(result.meta.last_row_id), status };
}

function buildManualReviewNote(input: {
  localTrust?: TrustRow | null;
  crossTrust?: TrustRow | null;
  crossDenied?: { display_name: string; review_note: string | null } | null;
  inviterTrust?: TrustRow | null;
  inviterName: string;
  verificationStatus: "verified" | "unverified";
}) {
  const notes: string[] = [];
  if (input.verificationStatus === "unverified") notes.push("Minecraft IDを照会で確認できませんでした。承認時にサーバー側で公式照会します。");
  if (input.localTrust?.state === "manual_required") notes.push(describeTrustReason(input.localTrust.reason));
  if (input.crossTrust) notes.push("別サーバーで管理履歴があります。" + describeTrustReason(input.crossTrust.reason));
  if (input.crossDenied) notes.push(`別サーバー「${input.crossDenied.display_name}」で申請が拒否されています。`);
  if (input.inviterTrust?.state === "blocked") notes.push(`招待者 ${input.inviterName} に管理制限があります。`);
  return notes.join(" / ") || "過去の管理履歴により手動確認が必要です。";
}

function describeTrustReason(reason: string | null) {
  const normalized = reason?.trim();
  if (!normalized) return "過去に承認後、取り消しされています。";
  const lower = normalized.toLowerCase();
  if (lower.includes("kick")) return "過去にKickされています。";
  if (lower.includes("ban") || lower.includes("block")) return "過去にBANまたはブロックされています。";
  if (lower.includes("remove") || lower.includes("revoke") || lower.includes("whitelist")) return "過去に承認後、取り消しされています。";
  return `過去の管理履歴: ${normalized}`;
}

const applicationSelect = `SELECT applications.id, applications.server_id, applications.minecraft_uuid, applications.minecraft_name,
  applications.discord_id, COALESCE(discord_users.global_name, discord_users.username, applications.discord_id) AS discord_display_name,
  applications.invite_code, applications.inviter_uuid, applications.inviter_name, applications.status, applications.created_at, applications.review_note,
  applications.verification_status, applications.verification_source
  FROM whitelist_applications AS applications LEFT JOIN discord_users ON discord_users.discord_id = applications.discord_id`;

export async function listPendingApplications(db: D1Database, serverId: string, page: number, pageSize = 10) {
  await ensureInviteSchema(db);
  const safePage = Math.max(1, page);
  const count = await db.prepare("SELECT COUNT(*) AS count FROM whitelist_applications WHERE server_id = ? AND status = 'pending'")
    .bind(serverId).first<{ count: number }>();
  const rows = await db.prepare(`${applicationSelect} WHERE applications.server_id = ? AND applications.status = 'pending' ORDER BY applications.created_at ASC LIMIT ? OFFSET ?`)
    .bind(serverId, pageSize, (safePage - 1) * pageSize).all<ApplicationRow>();
  return { page: safePage, total: count?.count ?? 0, applications: (rows.results ?? []).map(mapApplication) };
}

export async function getApplicationById(db: D1Database, id: number) {
  await ensureInviteSchema(db);
  const row = await db.prepare(`${applicationSelect} WHERE applications.id = ? LIMIT 1`).bind(id).first<ApplicationRow>();
  return row ? mapApplication(row) : null;
}

export async function reviewApplication(db: D1Database, input: {
  serverId: string; id: number; approve: boolean; reviewerUuid: string; reviewerName: string; note?: string; gameNotified?: boolean;
}) {
  await ensureInviteSchema(db);
  const status = input.approve ? "approved" : "denied";
  const existing = await db.prepare("SELECT minecraft_name FROM whitelist_applications WHERE id = ? AND server_id = ? AND status = 'pending' LIMIT 1")
    .bind(input.id, input.serverId).first<{ minecraft_name: string }>();
  if (!existing) return false;
  const reviewedAt = new Date().toISOString();
  const reviewNote = input.note?.trim() || null;
  const result = await db.prepare(`UPDATE whitelist_applications SET status = ?, reviewed_at = ?, reviewed_by_uuid = ?, reviewed_by_name = ?,
      review_note = CASE WHEN ? IS NULL THEN review_note WHEN review_note IS NULL OR review_note = '' THEN ? ELSE review_note || ' / ' || ? END,
      whitelist_synced = 0 WHERE id = ? AND server_id = ? AND status = 'pending'`)
    .bind(status, reviewedAt, input.reviewerUuid, input.reviewerName, reviewNote, reviewNote, reviewNote, input.id, input.serverId).run();
  const updated = (result.meta.changes ?? 0) > 0;
  if (updated) {
    await db.prepare(`INSERT INTO whitelist_review_events(server_id, application_id, minecraft_name, status, reviewer_name, created_at, game_notified)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.serverId, input.id, existing.minecraft_name, status, input.reviewerName, reviewedAt, input.gameNotified ? 1 : 0).run();
  }
  return updated;
}

export async function listUnnotifiedReviewEvents(db: D1Database, serverId: string, acknowledgedIds: number[]) {
  await ensureInviteSchema(db);
  if (acknowledgedIds.length) await db.batch(acknowledgedIds.map((id) => db.prepare("UPDATE whitelist_review_events SET game_notified = 1 WHERE id = ? AND server_id = ?").bind(id, serverId)));
  const rows = await db.prepare(`SELECT events.id, events.application_id, events.minecraft_name, applications.discord_id,
      COALESCE(discord_users.global_name, discord_users.username, applications.discord_id) AS discord_display_name,
      events.status, events.reviewer_name, events.created_at
      FROM whitelist_review_events AS events INNER JOIN whitelist_applications AS applications ON applications.id = events.application_id
      LEFT JOIN discord_users ON discord_users.discord_id = applications.discord_id
      WHERE events.server_id = ? AND events.game_notified = 0 ORDER BY events.id ASC LIMIT 100`)
    .bind(serverId).all<ReviewEventRow>();
  return (rows.results ?? []).map(mapReviewEvent);
}

export async function listUnsyncedApproved(db: D1Database, serverId: string) {
  await ensureInviteSchema(db);
  const rows = await db.prepare(`${applicationSelect} WHERE applications.server_id = ? AND applications.status = 'approved' AND applications.whitelist_synced = 0 ORDER BY applications.id ASC LIMIT 100`)
    .bind(serverId).all<ApplicationRow>();
  return (rows.results ?? []).map(mapApplication);
}

export async function markWhitelistSynced(db: D1Database, serverId: string, ids: number[]) {
  await ensureInviteSchema(db);
  if (ids.length) await db.batch(ids.map((id) => db.prepare("UPDATE whitelist_applications SET whitelist_synced = 1 WHERE id = ? AND server_id = ?").bind(id, serverId)));
}

export async function recordDiscordNotification(db: D1Database, input: {
  applicationId: number; discordId: string; channelId: string; messageId: string;
}) {
  await ensureInviteSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO whitelist_discord_notifications(application_id, discord_id, channel_id, message_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(application_id, discord_id) DO UPDATE SET
      channel_id = excluded.channel_id, message_id = excluded.message_id, updated_at = excluded.updated_at`)
    .bind(input.applicationId, input.discordId, input.channelId, input.messageId, now, now).run();
}

export async function listDiscordNotifications(db: D1Database, applicationId: number) {
  await ensureInviteSchema(db);
  const rows = await db.prepare(`SELECT discord_id, channel_id, message_id
    FROM whitelist_discord_notifications WHERE application_id = ?`).bind(applicationId)
    .all<{ discord_id: string; channel_id: string; message_id: string }>();
  return (rows.results ?? []).map((row): DiscordNotification => ({
    discordId: row.discord_id,
    channelId: row.channel_id,
    messageId: row.message_id,
  }));
}

export async function confirmApplicationMinecraftProfile(db: D1Database, input: {
  serverId: string; id: number; minecraftUuid: string; minecraftName: string;
}) {
  await ensureInviteSchema(db);
  const now = new Date().toISOString();
  const current = await db.prepare(
    "SELECT minecraft_uuid, discord_id FROM whitelist_applications WHERE id = ? AND server_id = ? AND status = 'approved' AND verification_status = 'unverified' LIMIT 1"
  ).bind(input.id, input.serverId).first<{ minecraft_uuid: string; discord_id: string }>();
  if (!current) return false;
  await db.batch([
    db.prepare(`UPDATE whitelist_applications SET minecraft_uuid = ?, minecraft_name = ?, verification_status = 'verified', verification_source = 'server_mojang'
      WHERE id = ? AND server_id = ?`).bind(input.minecraftUuid, input.minecraftName, input.id, input.serverId),
    db.prepare("DELETE FROM smanage_discord_links WHERE minecraft_uuid = ?").bind(current.minecraft_uuid),
    db.prepare(`INSERT INTO smanage_discord_links(minecraft_uuid, minecraft_name, discord_id, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(minecraft_uuid) DO UPDATE SET minecraft_name = excluded.minecraft_name, discord_id = excluded.discord_id, updated_at = excluded.updated_at`)
      .bind(input.minecraftUuid, input.minecraftName, current.discord_id, now),
  ]);
  return true;
}

export async function updateTrust(db: D1Database, input: { serverId: string; minecraftUuid: string; minecraftName: string; state: string; reason?: string }) {
  await ensureInviteSchema(db);
  const reason = input.reason?.trim() || null;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO whitelist_trust(server_id, minecraft_uuid, minecraft_name, state, reason, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(server_id, minecraft_uuid) DO UPDATE SET minecraft_name = excluded.minecraft_name,
      state = excluded.state, reason = excluded.reason, updated_at = excluded.updated_at`)
    .bind(input.serverId, input.minecraftUuid, input.minecraftName, input.state, reason, now).run();
  if (input.state !== "normal") {
    await db.prepare("INSERT INTO whitelist_trust_events(server_id, minecraft_uuid, minecraft_name, state, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(input.serverId, input.minecraftUuid, input.minecraftName, input.state, reason, now).run();
  }
}

export async function syncAdmin(db: D1Database, input: { serverId: string; minecraftUuid: string; minecraftName: string; role: "owner" | "admin"; active: boolean }) {
  await ensureInviteSchema(db);
  await db.prepare(`INSERT INTO smanage_admins(server_id, minecraft_uuid, minecraft_name, role, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(server_id, minecraft_uuid) DO UPDATE SET minecraft_name = excluded.minecraft_name,
      role = excluded.role, active = excluded.active, updated_at = excluded.updated_at`)
    .bind(input.serverId, input.minecraftUuid, input.minecraftName, input.role, input.active ? 1 : 0, new Date().toISOString()).run();
}

export async function getAdminDiscordIds(db: D1Database, serverId: string) {
  await ensureInviteSchema(db);
  const rows = await db.prepare(`SELECT DISTINCT linked.discord_id FROM (
      SELECT admins.minecraft_uuid, mc_links.discord_id FROM smanage_admins AS admins INNER JOIN mc_links ON mc_links.minecraft_uuid = admins.minecraft_uuid WHERE admins.server_id = ? AND admins.active = 1 AND mc_links.active = 1
      UNION
      SELECT admins.minecraft_uuid, applications.discord_id FROM smanage_admins AS admins INNER JOIN whitelist_applications AS applications ON applications.minecraft_uuid = admins.minecraft_uuid WHERE admins.server_id = ? AND admins.active = 1 AND applications.server_id = ? AND applications.status = 'approved'
      UNION
      SELECT admins.minecraft_uuid, links.discord_id FROM smanage_admins AS admins INNER JOIN smanage_discord_links AS links ON links.minecraft_uuid = admins.minecraft_uuid WHERE admins.server_id = ? AND admins.active = 1
    ) AS linked
    LEFT JOIN smanage_admin_dm_settings AS settings
      ON settings.server_id = ? AND settings.minecraft_uuid = linked.minecraft_uuid
    WHERE COALESCE(settings.enabled, 1) = 1`)
    .bind(serverId, serverId, serverId, serverId, serverId).all<{ discord_id: string }>();
  return (rows.results ?? []).map((row) => row.discord_id);
}

export async function listApplicationHistory(db: D1Database, serverId: string, page: number, status?: "approved" | "denied", pageSize = 10) {
  await ensureInviteSchema(db);
  const safePage = Math.max(1, page);
  const filter = status ? "AND applications.status = ?" : "AND applications.status IN ('approved', 'denied')";
  const countQuery = db.prepare(`SELECT COUNT(*) AS count FROM whitelist_applications AS applications WHERE applications.server_id = ? ${filter}`);
  const count = status ? await countQuery.bind(serverId, status).first<{ count: number }>() : await countQuery.bind(serverId).first<{ count: number }>();
  const query = db.prepare(`${applicationSelect} WHERE applications.server_id = ? ${filter} ORDER BY applications.id DESC LIMIT ? OFFSET ?`);
  const rows = status ? await query.bind(serverId, status, pageSize, (safePage - 1) * pageSize).all<ApplicationRow>() : await query.bind(serverId, pageSize, (safePage - 1) * pageSize).all<ApplicationRow>();
  return { page: safePage, total: count?.count ?? 0, applications: (rows.results ?? []).map(mapApplication) };
}

export async function resetInviteData(db: D1Database, serverId: string) {
  await ensureInviteSchema(db);
  await db.batch([
    db.prepare("DELETE FROM whitelist_review_events WHERE server_id = ?").bind(serverId),
    db.prepare("DELETE FROM whitelist_applications WHERE server_id = ?").bind(serverId),
    db.prepare("DELETE FROM invite_codes WHERE server_id = ?").bind(serverId),
    db.prepare("DELETE FROM whitelist_trust WHERE server_id = ?").bind(serverId),
    db.prepare("DELETE FROM whitelist_trust_events WHERE server_id = ?").bind(serverId),
  ]);
}
