import type { UmigameAvatarType } from "./avatar";
import type { UmigameEnv } from "./env.server";
import { reviewComment } from "./comment-review.server";

export type CommentStatus =
  | "pending"
  | "visible"
  | "spoiler"
  | "hidden_pending_review";

export interface PuzzleComment {
  id: string;
  body: string;
  status: CommentStatus;
  createdAt: number;
  reviewedAt: number | null;
  isOwn: boolean;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarType: UmigameAvatarType;
    avatarIcon: string | null;
    avatarColor: string | null;
    externalAvatarUrl: string | null;
    deleted: boolean;
  };
}

interface CommentRow {
  id: string;
  body: string;
  status: CommentStatus;
  created_at: number;
  reviewed_at: number | null;
  author_user_id: string;
  username: string;
  display_name: string;
  avatar_type: string;
  avatar_icon: string | null;
  avatar_color: string | null;
  external_avatar_url: string | null;
  deleted_at: number | null;
}

function normalizeAvatarType(value: string): UmigameAvatarType {
  return value === "oauth" || value === "generated" ? value : "lucide";
}

function mapComment(row: CommentRow, viewerUserId: string | null): PuzzleComment {
  return {
    id: row.id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    isOwn: viewerUserId === row.author_user_id,
    author: {
      id: row.author_user_id,
      username: row.username,
      displayName: row.deleted_at ? "退会済みユーザー" : row.display_name,
      avatarType: normalizeAvatarType(row.avatar_type),
      avatarIcon: row.avatar_icon,
      avatarColor: row.avatar_color,
      externalAvatarUrl: row.deleted_at ? null : row.external_avatar_url,
      deleted: Boolean(row.deleted_at),
    },
  };
}

export async function listPuzzleComments(
  db: D1Database,
  puzzleId: string,
  viewerUserId: string | null,
) {
  const result = await db.prepare(
    `SELECT c.id, c.body, c.status, c.created_at, c.reviewed_at,
            c.author_user_id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
            u.avatar_color, u.external_avatar_url, u.deleted_at
     FROM comments c
     JOIN users u ON u.id = c.author_user_id
     WHERE c.puzzle_id = ?
       AND (
         c.status IN ('visible', 'spoiler')
         OR (? IS NOT NULL AND c.author_user_id = ?)
       )
     ORDER BY c.created_at DESC, c.id DESC`,
  ).bind(puzzleId, viewerUserId, viewerUserId).all<CommentRow>();

  return (result.results ?? []).map((row) => mapComment(row, viewerUserId));
}

export async function createPuzzleComment(
  db: D1Database,
  input: {
    puzzleId: string;
    revisionId: string;
    authorUserId: string;
    body: string;
  },
) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 2000) {
    throw new Response("コメントは1〜2000文字で入力してください。", { status: 400 });
  }

  const now = Date.now();
  const since = now - 10 * 60 * 1000;
  const id = crypto.randomUUID();
  const inserted = await db.prepare(
    `INSERT INTO comments
      (id, puzzle_id, revision_id, author_user_id, body, status,
       created_at, updated_at, reviewed_at)
     SELECT ?, ?, ?, ?, ?, 'pending', ?, ?, NULL
     WHERE (SELECT COUNT(*) FROM comments WHERE author_user_id = ? AND created_at >= ?) < 10
     RETURNING id`,
  ).bind(
    id,
    input.puzzleId,
    input.revisionId,
    input.authorUserId,
    body,
    now,
    now,
    input.authorUserId,
    since,
  ).first<{ id: string }>();

  if (!inserted) {
    throw new Response("コメントの投稿回数が多すぎます。少し時間を空けてください。", {
      status: 429,
    });
  }
  return inserted.id;
}

export async function reportCommentNotSpoiler(
  db: D1Database,
  commentId: string,
  reporterUserId: string,
) {
  const exists = await db.prepare(
    "SELECT id FROM comments WHERE id = ? AND status = 'spoiler' LIMIT 1",
  ).bind(commentId).first<{ id: string }>();
  if (!exists) {
    throw new Response("対象のコメントが見つかりません。", { status: 404 });
  }

  await db.prepare(
    `INSERT OR IGNORE INTO comment_reports
      (id, comment_id, reporter_user_id, reason, created_at)
     VALUES (?, ?, ?, 'not_spoiler', ?)`,
  ).bind(crypto.randomUUID(), commentId, reporterUserId, Date.now()).run();
}

export async function enqueueCommentReview(env: UmigameEnv, commentId: string) {
  if (env.UMIGAME_AI_QUEUE) {
    await env.UMIGAME_AI_QUEUE.send({
      type: "comment_review",
      commentId,
    });
    return "queue" as const;
  }

  await reviewComment(env, commentId);
  return "inline" as const;
}
