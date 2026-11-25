import type { JSONContent } from "@tiptap/core";
import { emptyArticleBody, randomId } from "./content";

export type ArticleStatus = "draft" | "unlisted" | "published";

export interface ArticleDraft {
  title: string;
  summary: string;
  body: JSONContent;
}

export interface EditableArticle extends ArticleDraft {
  id: string;
  revision: number;
  status: ArticleStatus;
  updatedAt: number;
  firstPublishedAt: number | null;
  contentPublishedAt: number | null;
  hasUnpublishedChanges: boolean;
}

export interface ArticleListItem {
  id: string;
  title: string;
  status: ArticleStatus;
  updatedAt: number;
  hasUnpublishedChanges: boolean;
}

interface ArticleRow {
  id: string;
  revision: number;
  title: string;
  summary: string;
  body_json: string;
  status: ArticleStatus;
  updated_at: number;
  first_published_at: number | null;
  content_published_at: number | null;
  has_unpublished_changes: number;
}

// 時刻ではなく値で比べる。一文を直して元に戻したときに「変更あり」と出さないため。
const HAS_UNPUBLISHED_CHANGES = `(status <> 'draft' AND (title IS NOT published_title OR summary IS NOT published_summary OR body_json IS NOT published_body_json)) AS has_unpublished_changes`;

function toEditable(row: ArticleRow): EditableArticle {
  return {
    id: row.id,
    revision: row.revision,
    title: row.title,
    summary: row.summary,
    body: JSON.parse(row.body_json) as JSONContent,
    status: row.status,
    updatedAt: row.updated_at,
    firstPublishedAt: row.first_published_at,
    contentPublishedAt: row.content_published_at,
    hasUnpublishedChanges: row.has_unpublished_changes === 1,
  };
}

export async function listArticles(db: D1Database): Promise<ArticleListItem[]> {
  const { results } = await db.prepare(
    `SELECT id, title, status, updated_at, ${HAS_UNPUBLISHED_CHANGES} FROM articles ORDER BY updated_at DESC`,
  ).all<Pick<ArticleRow, "id" | "title" | "status" | "updated_at" | "has_unpublished_changes">>();
  return results.map(row => ({
    id: row.id,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
    hasUnpublishedChanges: row.has_unpublished_changes === 1,
  }));
}

export async function getEditableArticle(db: D1Database, id: string) {
  const row = await db.prepare(
    `SELECT id, revision, title, summary, body_json, status, updated_at, first_published_at, content_published_at, ${HAS_UNPUBLISHED_CHANGES} FROM articles WHERE id = ?`,
  ).bind(id).first<ArticleRow>();
  return row ? toEditable(row) : null;
}

export async function createArticle(db: D1Database) {
  const now = Date.now();
  const body = JSON.stringify(emptyArticleBody());
  // 60ビットのIDが衝突することはまず無いが、主キーの一意制約で失敗したら1回だけ作り直す。
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = randomId(12);
    try {
      await db.prepare("INSERT INTO articles (id, body_json, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(id, body, now, now).run();
      return id;
    } catch (error) {
      if (attempt === 1 || !String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("unreachable");
}

export type WriteResult =
  | { ok: true; revision: number; updatedAt: number; hasUnpublishedChanges: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; revision: number }
  | { ok: false; reason: "status_changed"; status: ArticleStatus };

interface WrittenRow { revision: number; has_unpublished_changes: number }

function written(row: WrittenRow, updatedAt: number): WriteResult {
  return { ok: true, revision: row.revision, updatedAt, hasUnpublishedChanges: row.has_unpublished_changes === 1 };
}

async function conflictOrMissing(db: D1Database, id: string, baseRevision: number): Promise<WriteResult> {
  const row = await db.prepare("SELECT revision, status FROM articles WHERE id = ?").bind(id).first<{ revision: number; status: ArticleStatus }>();
  if (!row) return { ok: false, reason: "not_found" };
  if (row.revision !== baseRevision) return { ok: false, reason: "conflict", revision: row.revision };
  return { ok: false, reason: "status_changed", status: row.status };
}

export async function saveDraft(db: D1Database, id: string, baseRevision: number, draft: ArticleDraft): Promise<WriteResult> {
  const now = Date.now();
  const row = await db.prepare(
    `UPDATE articles SET title = ?, summary = ?, body_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING revision, ${HAS_UNPUBLISHED_CHANGES}`,
  ).bind(draft.title, draft.summary, JSON.stringify(draft.body), now, id, baseRevision).first<WrittenRow>();
  return row ? written(row, now) : conflictOrMissing(db, id, baseRevision);
}

// 公開には「初回」と「更新」があり、画面がどちらのつもりで押したかを送らせる。
// 非公開に戻しても revision は進まないので、古い画面の「更新を公開」が下書きを
// 初回公開として扱ってしまわないよう、今の状態とも照合する。
export type PublishMode =
  | { kind: "first"; status: Exclude<ArticleStatus, "draft"> }
  | { kind: "update" };

// 画面の原稿の保存と公開版へのコピーを1つのUPDATEで行う。自動保存が間に合わず、
// 一つ前の原稿を公開してしまうのを防ぐため。
export async function publishArticle(
  db: D1Database,
  id: string,
  baseRevision: number,
  draft: ArticleDraft,
  mode: PublishMode,
): Promise<WriteResult> {
  const now = Date.now();
  const body = JSON.stringify(draft.body);
  const first = mode.kind === "first";
  const row = await db.prepare(
    `UPDATE articles SET
       title = ?1, summary = ?2, body_json = ?3,
       published_title = ?1, published_summary = ?2, published_body_json = ?3,
       status = ${first ? "?4" : "status"},
       first_published_at = COALESCE(first_published_at, ?5),
       content_published_at = ?5,
       revision = revision + 1, updated_at = ?5
     WHERE id = ?6 AND revision = ?7 AND ${first ? "status = 'draft'" : "status <> 'draft'"}
     RETURNING revision, ${HAS_UNPUBLISHED_CHANGES}`,
  ).bind(draft.title, draft.summary, body, first ? mode.status : null, now, id, baseRevision).first<WrittenRow>();
  return row ? written(row, now) : conflictOrMissing(db, id, baseRevision);
}

// 限定公開と一般公開の切り替え。公開版の本文は変えないので、書きかけの修正は載らない。
// 画面が見ていた状態（from）と今の状態が違えば変えない。
export async function setVisibility(
  db: D1Database,
  id: string,
  from: Exclude<ArticleStatus, "draft">,
  to: Exclude<ArticleStatus, "draft">,
) {
  const result = await db.prepare("UPDATE articles SET status = ? WHERE id = ? AND status = ?").bind(to, id, from).run();
  return result.meta.changes > 0;
}

// 非公開に戻す。公開版は空にし、書いている版と初公開日は残す。
export async function unpublishArticle(db: D1Database, id: string) {
  const result = await db.prepare(
    "UPDATE articles SET status = 'draft', published_title = NULL, published_summary = NULL, published_body_json = NULL, content_published_at = NULL WHERE id = ? AND status <> 'draft'",
  ).bind(id).run();
  return result.meta.changes > 0;
}
