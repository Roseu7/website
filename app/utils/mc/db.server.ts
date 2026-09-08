import type {
  DashboardDiscordUser,
  DashboardMinecraftLink,
  DashboardPlayer,
  DashboardServerState,
} from "~/utils/mc/dashboard";

let schemaReady: Promise<void> | null = null;

interface DiscordUserRow {
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
}

interface MinecraftLinkRow {
  discord_id?: string;
  minecraft_uuid: string;
  minecraft_name: string;
  linked_at: string;
  username?: string | null;
  global_name?: string | null;
}

interface ServerStateRow {
  server_id: string;
  online: number;
  player_count: number;
  max_players: number;
  players_json: string;
  checked_at: string;
}

interface LinkCodeRow {
  code: string;
  minecraft_uuid: string;
  minecraft_name: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface DiscordProfileInput {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarHash: string | null;
}

export interface RegisterLinkCodeInput {
  code: string;
  minecraftUuid: string;
  minecraftName: string;
  expiresAt: string;
}

export interface UpdateServerStateInput {
  serverId: string;
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  players: DashboardPlayer[];
  checkedAt: string;
}

async function ensureServerStateCompatibility(db: D1Database) {
  const columns = await db.prepare("PRAGMA table_info(server_state)").all<{ name?: string }>();
  const names = new Set(
    (columns.results ?? [])
      .map((column) => column.name)
      .filter((value): value is string => typeof value === "string")
  );

  if (!names.has("max_players")) {
    await db
      .prepare("ALTER TABLE server_state ADD COLUMN max_players INTEGER NOT NULL DEFAULT 0")
      .run();
  }
}

/**
 * D1 migrations are the schema source of truth.
 * Keep only the compatibility upgrade for databases created before max_players was added.
 */
export async function ensureSchemaCompatibility(db: D1Database) {
  if (!schemaReady) {
    schemaReady = ensureServerStateCompatibility(db)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

function buildDiscordAvatarUrl(discordId: string, avatarHash: string | null) {
  if (!avatarHash) {
    return null;
  }
  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}?size=160`;
}

function parsePlayers(json: string): DashboardPlayer[] {
  try {
    const value = JSON.parse(json) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.flatMap((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { uuid?: unknown }).uuid === "string" &&
        typeof (item as { name?: unknown }).name === "string"
      ) {
        return [
          {
            uuid: (item as { uuid: string }).uuid,
            name: (item as { name: string }).name,
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export async function upsertDiscordUser(db: D1Database, input: DiscordProfileInput) {
  await ensureSchemaCompatibility(db);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO discord_users (
        discord_id, username, global_name, avatar_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        global_name = excluded.global_name,
        avatar_hash = excluded.avatar_hash,
        updated_at = excluded.updated_at`
    )
    .bind(
      input.discordId,
      input.username,
      input.globalName,
      input.avatarHash,
      now,
      now
    )
    .run();
}

export async function getDiscordUser(db: D1Database, discordId: string): Promise<DashboardDiscordUser | null> {
  await ensureSchemaCompatibility(db);
  const row = await db
    .prepare(
      `SELECT discord_id, username, global_name, avatar_hash
       FROM discord_users
       WHERE discord_id = ?
       LIMIT 1`
    )
    .bind(discordId)
    .first<DiscordUserRow>();

  if (!row) {
    return null;
  }

  return {
    discordId: row.discord_id,
    username: row.username,
    globalName: row.global_name,
    avatarUrl: buildDiscordAvatarUrl(row.discord_id, row.avatar_hash),
  };
}

export async function getActiveMinecraftLink(
  db: D1Database,
  discordId: string
): Promise<DashboardMinecraftLink | null> {
  await ensureSchemaCompatibility(db);
  const row = await db
    .prepare(
      `SELECT minecraft_uuid, minecraft_name, linked_at
       FROM mc_links
       WHERE discord_id = ? AND active = 1
       ORDER BY linked_at DESC
       LIMIT 1`
    )
    .bind(discordId)
    .first<MinecraftLinkRow>();

  if (!row) {
    return null;
  }

  return {
    minecraftUuid: row.minecraft_uuid,
    minecraftName: row.minecraft_name,
    linkedAt: row.linked_at,
  };
}

export async function getActiveLinkByMinecraftUuid(
  db: D1Database,
  minecraftUuid: string
): Promise<(DashboardMinecraftLink & { discordId: string; discordDisplayName: string }) | null> {
  await ensureSchemaCompatibility(db);
  const row = await db
    .prepare(
      `SELECT
         mc_links.discord_id,
         mc_links.minecraft_uuid,
         mc_links.minecraft_name,
         mc_links.linked_at,
         discord_users.username,
         discord_users.global_name
       FROM mc_links
       LEFT JOIN discord_users
         ON discord_users.discord_id = mc_links.discord_id
       WHERE mc_links.minecraft_uuid = ? AND mc_links.active = 1
       ORDER BY mc_links.linked_at DESC
       LIMIT 1`
    )
    .bind(minecraftUuid)
    .first<MinecraftLinkRow>();

  if (!row || !row.discord_id) {
    return null;
  }

  return {
    discordId: row.discord_id,
    discordDisplayName: row.global_name ?? row.username ?? row.discord_id,
    minecraftUuid: row.minecraft_uuid,
    minecraftName: row.minecraft_name,
    linkedAt: row.linked_at,
  };
}

export async function consumeLinkCodeAndLinkDiscord(
  db: D1Database,
  discordId: string,
  code: string
) {
  await ensureSchemaCompatibility(db);

  const normalizedCode = code.trim().toUpperCase();
  const row = await db
    .prepare(
      `SELECT code, minecraft_uuid, minecraft_name, expires_at, consumed_at
       FROM link_codes
       WHERE code = ?
       LIMIT 1`
    )
    .bind(normalizedCode)
    .first<LinkCodeRow>();

  if (!row) {
    return { ok: false as const, message: "リンクコードが見つかりません。" };
  }

  if (row.consumed_at) {
    return { ok: false as const, message: "このリンクコードはすでに使用されています。" };
  }

  const now = new Date().toISOString();
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, message: "このリンクコードは期限切れです。" };
  }

  await db.batch([
    db.prepare(
      `UPDATE link_codes
       SET consumed_at = ?
       WHERE code = ?`
    ).bind(now, normalizedCode),
    db.prepare(
      `UPDATE mc_links
       SET active = 0, unlinked_at = ?
       WHERE discord_id = ? AND active = 1`
    ).bind(now, discordId),
    db.prepare(
      `UPDATE mc_links
       SET active = 0, unlinked_at = ?
       WHERE minecraft_uuid = ? AND active = 1`
    ).bind(now, row.minecraft_uuid),
    db.prepare(
      `INSERT INTO mc_links (
        discord_id, minecraft_uuid, minecraft_name, linked_at, unlinked_at, active
      ) VALUES (?, ?, ?, ?, NULL, 1)`
    ).bind(discordId, row.minecraft_uuid, row.minecraft_name, now),
  ]);

  return {
    ok: true as const,
    link: {
      minecraftUuid: row.minecraft_uuid,
      minecraftName: row.minecraft_name,
      linkedAt: now,
    } satisfies DashboardMinecraftLink,
  };
}

export async function registerLinkCode(db: D1Database, input: RegisterLinkCodeInput) {
  await ensureSchemaCompatibility(db);
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO link_codes (
        code, minecraft_uuid, minecraft_name, expires_at, created_at, consumed_at
      ) VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(code) DO UPDATE SET
        minecraft_uuid = excluded.minecraft_uuid,
        minecraft_name = excluded.minecraft_name,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at,
        consumed_at = NULL`
    )
    .bind(
      input.code.trim().toUpperCase(),
      input.minecraftUuid,
      input.minecraftName,
      input.expiresAt,
      createdAt
    )
    .run();
}

export async function unlinkMinecraftAccountByDiscordId(db: D1Database, discordId: string) {
  await ensureSchemaCompatibility(db);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE mc_links
       SET active = 0, unlinked_at = ?
       WHERE discord_id = ? AND active = 1`
    )
    .bind(now, discordId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function unlinkMinecraftAccountByUuid(db: D1Database, minecraftUuid: string) {
  await ensureSchemaCompatibility(db);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE mc_links
       SET active = 0, unlinked_at = ?
       WHERE minecraft_uuid = ? AND active = 1`
    )
    .bind(now, minecraftUuid)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function updateServerState(db: D1Database, input: UpdateServerStateInput) {
  await ensureSchemaCompatibility(db);
  await db
    .prepare(
      `INSERT INTO server_state (
        server_id, online, player_count, max_players, players_json, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(server_id) DO UPDATE SET
        online = excluded.online,
        player_count = excluded.player_count,
        max_players = excluded.max_players,
        players_json = excluded.players_json,
        checked_at = excluded.checked_at`
    )
    .bind(
      input.serverId,
      input.online ? 1 : 0,
      input.playerCount,
      input.maxPlayers,
      JSON.stringify(input.players),
      input.checkedAt
    )
    .run();
}

export async function getServerState(
  db: D1Database,
  serverId = "main"
): Promise<DashboardServerState | null> {
  await ensureSchemaCompatibility(db);
  const row = await db
    .prepare(
      `SELECT server_id, online, player_count, max_players, players_json, checked_at
       FROM server_state
       WHERE server_id = ?
       LIMIT 1`
    )
    .bind(serverId)
    .first<ServerStateRow>();

  if (!row) {
    return null;
  }

  return {
    serverId: row.server_id,
    online: row.online === 1,
    playerCount: row.player_count,
    maxPlayers: row.max_players,
    players: parsePlayers(row.players_json),
    checkedAt: row.checked_at,
  };
}
