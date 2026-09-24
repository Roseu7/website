import {
  normalizeAvatarColor,
  normalizeAvatarIcon,
  type UmigameAvatarColor,
  type UmigameAvatarIcon,
  type UmigameAvatarType,
} from "./avatar";
import { formatPuzzlePublicId } from "./db.server";

export interface UmigameUser {
  id: string;
  username: string;
  displayName: string;
  avatarType: UmigameAvatarType;
  avatarIcon: string | null;
  avatarColor: string | null;
  externalAvatarUrl: string | null;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  avatar_type: string;
  avatar_icon: string | null;
  avatar_color: string | null;
  external_avatar_url: string | null;
}

function mapUser(row: UserRow): UmigameUser {
  const avatarType: UmigameAvatarType =
    row.avatar_type === "oauth" || row.avatar_type === "generated" ? row.avatar_type : "lucide";
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarType,
    avatarIcon: row.avatar_icon,
    avatarColor: row.avatar_color,
    externalAvatarUrl: row.external_avatar_url,
  };
}

export async function getUmigameUser(db: D1Database, userId: string) {
  const row = await db.prepare(
    `SELECT id, username, display_name, avatar_type, avatar_icon, avatar_color, external_avatar_url
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`
  ).bind(userId).first<UserRow>();
  return row ? mapUser(row) : null;
}

export async function isExistingUmigameUserId(db: D1Database, userId: string) {
  const row = await db.prepare(
    "SELECT 1 AS existing FROM users WHERE id = ? LIMIT 1",
  ).bind(userId).first<{ existing: number }>();
  return row !== null;
}

export async function getUmigameUserByUsername(db: D1Database, username: string) {
  const row = await db.prepare(
    `SELECT id, username, display_name, avatar_type, avatar_icon, avatar_color, external_avatar_url
     FROM users WHERE username = ? AND deleted_at IS NULL LIMIT 1`
  ).bind(username).first<UserRow>();
  return row ? mapUser(row) : null;
}

export async function getUmigameProfileStats(db: D1Database, userId: string) {
  const row = await db.prepare(
    `SELECT
      (SELECT COUNT(DISTINCT r.puzzle_id)
         FROM play_sessions s
         JOIN puzzle_revisions r ON r.id = s.revision_id
        WHERE s.actor_id = ? AND s.started_at >= r.created_at) AS played_count,
      (SELECT COUNT(*)
         FROM user_puzzle_first_results f
         JOIN play_sessions s ON s.id = f.session_id
         JOIN puzzle_revisions r ON r.id = s.revision_id
        WHERE f.user_id = ? AND f.outcome = 'solved' AND f.completed_at >= r.created_at) AS truth_reached_count`
  ).bind(userId, userId).first<{
    played_count: number;
    truth_reached_count: number;
  }>();
  return {
    playedCount: row?.played_count ?? 0,
    truthReachedCount: row?.truth_reached_count ?? 0,
  };
}

export interface FirstPlayResult {
  puzzleId: string;
  displayId: string;
  title: string;
  published: boolean;
  outcome: "solved" | "gave_up";
  questionCount: number;
  guessCount: number;
  hintCount: number;
  durationMs: number;
  completedAt: number;
}

export async function listUserFirstPlayResults(
  db: D1Database,
  userId: string,
  requestedPage: number,
) {
  const pageSize = 20;
  const from = `
    FROM user_puzzle_first_results f
    JOIN play_sessions s ON s.id = f.session_id
    JOIN puzzle_revisions r ON r.id = s.revision_id
    JOIN puzzles p ON p.id = r.puzzle_id AND p.id = f.puzzle_id
    WHERE f.user_id = ? AND s.actor_id = f.user_id
      AND s.started_at >= r.created_at
      AND f.completed_at >= r.created_at`;
  const count = await db.prepare(`SELECT COUNT(*) AS total ${from}`)
    .bind(userId).first<{ total: number }>();
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const rows = await db.prepare(`
    SELECT f.puzzle_id, p.public_id, r.title, p.status,
           f.outcome, f.question_count, f.guess_count, f.hint_count,
           f.duration_ms, f.completed_at
    ${from}
    ORDER BY f.completed_at DESC, f.puzzle_id DESC
    LIMIT ? OFFSET ?`)
    .bind(userId, pageSize, (page - 1) * pageSize)
    .all<{
      puzzle_id: string;
      public_id: number;
      title: string;
      status: string;
      outcome: "solved" | "gave_up";
      question_count: number;
      guess_count: number;
      hint_count: number;
      duration_ms: number;
      completed_at: number;
    }>();

  return {
    results: rows.results.map((row): FirstPlayResult => ({
      puzzleId: row.puzzle_id,
      displayId: formatPuzzlePublicId(row.public_id),
      title: row.title,
      published: row.status === "published",
      outcome: row.outcome,
      questionCount: row.question_count,
      guessCount: row.guess_count,
      hintCount: row.hint_count,
      durationMs: row.duration_ms,
      completedAt: row.completed_at,
    })),
    total,
    page,
    pageCount,
  };
}

export interface AccessIdentityInput {
  email: string;
  displayName?: string | null;
}

export async function upsertAccessUser(db: D1Database, input: AccessIdentityInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon, u.avatar_color, u.external_avatar_url
     FROM user_identities i JOIN users u ON u.id = i.user_id
     WHERE i.provider = 'access' AND i.provider_subject = ?
       AND u.deleted_at IS NULL
     LIMIT 1`
  ).bind(email).first<UserRow>();
  const now = Date.now();

  if (existing) {
    await db.prepare(
      `UPDATE user_identities
       SET email = ?, email_verified = 1, updated_at = ?
       WHERE provider = 'access' AND provider_subject = ?`
    ).bind(email, now, email).run();
    return mapUser(existing);
  }

  const emailMatch = await db.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon, u.avatar_color, u.external_avatar_url
     FROM user_identities i JOIN users u ON u.id = i.user_id
     WHERE lower(i.email) = ?
       AND u.deleted_at IS NULL
     LIMIT 1`
  ).bind(email).first<UserRow>();

  if (emailMatch) {
    await db.prepare(
      `INSERT OR IGNORE INTO user_identities
       (user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
       VALUES (?, 'access', ?, ?, 1, ?, ?)`
    ).bind(emailMatch.id, email, email, now, now).run();
    return mapUser(emailMatch);
  }

  const userId = crypto.randomUUID();
  const username = `u-${userId.replaceAll("-", "").slice(0, 16).toLowerCase()}`;
  const fallbackName = email.split("@")[0] || email;
  const displayName = (input.displayName?.trim() || fallbackName).slice(0, 40);
  await db.batch([
    db.prepare(
      `INSERT INTO users
       (id, username, display_name, avatar_type, avatar_icon, avatar_color, external_avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, 'generated', 'user', 'slate', NULL, ?, ?)`
    ).bind(userId, username, displayName, now, now),
    db.prepare(
      `INSERT INTO user_identities
       (user_id, provider, provider_subject, email, email_verified, created_at, updated_at)
       VALUES (?, 'access', ?, ?, 1, ?, ?)`
    ).bind(userId, email, email, now, now),
  ]);

  return {
    id: userId,
    username,
    displayName,
    avatarType: "generated",
    avatarIcon: "user",
    avatarColor: "slate",
    externalAvatarUrl: null,
  } satisfies UmigameUser;
}

export async function updateUmigameProfile(
  db: D1Database,
  userId: string,
  input: {
    displayName: string;
    avatarType: UmigameAvatarType;
    avatarIcon?: unknown;
    avatarColor?: unknown;
  },
) {
  const current = await getUmigameUser(db, userId);
  if (!current) throw new Response("User not found.", { status: 404 });

  const avatarType: UmigameAvatarType =
    input.avatarType === "oauth" && current.externalAvatarUrl
      ? "oauth"
      : input.avatarType === "generated"
        ? "generated"
        : "lucide";
  const avatarIcon: UmigameAvatarIcon = normalizeAvatarIcon(input.avatarIcon);
  const avatarColor: UmigameAvatarColor = normalizeAvatarColor(input.avatarColor);

  await db.prepare(
    `UPDATE users
     SET display_name = ?, avatar_type = ?, avatar_icon = ?, avatar_color = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    input.displayName,
    avatarType,
    avatarIcon,
    avatarColor,
    Date.now(),
    userId,
  ).run();

  return getUmigameUser(db, userId);
}

export async function deleteUmigameAccount(
  db: D1Database,
  userId: string,
) {
  const now = Date.now();
  const deletedActorId = "deleted:" + crypto.randomUUID();

  await db.batch([
    db.prepare("DELETE FROM user_identities WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM user_puzzle_first_results WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM votes WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM favorites WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM comment_reports WHERE reporter_user_id = ?").bind(userId),
    db.prepare("UPDATE play_sessions SET actor_id = ? WHERE actor_id = ?").bind(
      deletedActorId,
      userId,
    ),
    db.prepare(
      "UPDATE moderation_events SET admin_actor_id = NULL WHERE admin_actor_id = ?",
    ).bind(userId),
    db.prepare(
      "UPDATE jev_runs SET target_id = NULL WHERE purpose = 'display_name' AND target_id = ?",
    ).bind(userId),
    db.prepare(
      `UPDATE users
       SET display_name = '退会済みユーザー',
           avatar_type = 'generated',
           avatar_icon = 'user',
           avatar_color = 'slate',
           external_avatar_url = NULL,
           is_admin = 0,
           deleted_at = ?,
           updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    ).bind(now, now, userId),
  ]);
}

export async function claimAnonymousPlaySessions(
  db: D1Database,
  anonymousActorId: string,
  userId: string,
) {
  await db.prepare(
    "UPDATE play_sessions SET actor_id = ? WHERE actor_id = ?"
  ).bind(userId, anonymousActorId).run();
}
