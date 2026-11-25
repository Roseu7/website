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
  createdAt: number;
  firstPublishedAt: number | null;
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

export interface PublicArticle {
  id: string;
  status: Exclude<ArticleStatus, "draft">;
  title: string;
  summary: string;
  body: JSONContent;
  firstPublishedAt: number;
  contentPublishedAt: number;
}

interface PublicRow {
  id: string;
  status: Exclude<ArticleStatus, "draft">;
  published_title: string;
  published_summary: string;
  published_body_json: string;
  first_published_at: number;
  content_published_at: number;
}

const PUBLIC_COLUMNS = "id, status, published_title, published_summary, published_body_json, first_published_at, content_published_at";

function toPublic(row: PublicRow): PublicArticle {
  return {
    id: row.id,
    status: row.status,
    title: row.published_title,
    summary: row.published_summary,
    body: JSON.parse(row.published_body_json) as JSONContent,
    firstPublishedAt: row.first_published_at,
    contentPublishedAt: row.content_published_at,
  };
}

// 公開側は公開版の列だけを読む。下書きと存在しないIDは、どちらも「行がない」という同じ経路で404にする。
export async function getPublicArticle(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM articles WHERE id = ? AND status <> 'draft'`).bind(id).first<PublicRow>();
  return row ? toPublic(row) : null;
}

export interface AdjacentArticle { id: string; title: string; firstPublishedAt: number }

// 一覧と同じ順番（初めて公開した日時、同じなら記事ID）で、前（古い）と次（新しい）の一般公開の記事を引く。
export async function getAdjacentArticles(db: D1Database, current: { id: string; firstPublishedAt: number }) {
  const columns = "id, published_title AS title, first_published_at AS firstPublishedAt";
  const [older, newer] = await db.batch<AdjacentArticle>([
    db.prepare(`SELECT ${columns} FROM articles WHERE status = 'published' AND (first_published_at < ?1 OR (first_published_at = ?1 AND id < ?2)) ORDER BY first_published_at DESC, id DESC LIMIT 1`).bind(current.firstPublishedAt, current.id),
    db.prepare(`SELECT ${columns} FROM articles WHERE status = 'published' AND (first_published_at > ?1 OR (first_published_at = ?1 AND id > ?2)) ORDER BY first_published_at ASC, id ASC LIMIT 1`).bind(current.firstPublishedAt, current.id),
  ]);
  return { previous: older.results[0] ?? null, next: newer.results[0] ?? null };
}

export interface PublicListItem {
  id: string;
  title: string;
  summary: string;
  // 概要が空の記事だけ、抜粋を作るために本文を持たせる。
  body: JSONContent | null;
  firstPublishedAt: number;
  contentPublishedAt: number;
}

// 一覧に出すのは一般公開だけ。限定公開は、URLを知っている人だけが読める。
// 並びは前後の記事と同じ（初めて公開した日時、同じなら記事ID）。
// 本文は、概要が空で抜粋を作る必要がある記事の分だけ読む。
export async function listPublicArticles(db: D1Database): Promise<PublicListItem[]> {
  const { results } = await db.prepare(
    `SELECT id, published_title, published_summary, first_published_at, content_published_at,
       CASE WHEN published_summary = '' THEN published_body_json END AS excerpt_body_json
     FROM articles WHERE status = 'published' ORDER BY first_published_at DESC, id DESC`,
  ).all<{ id: string; published_title: string; published_summary: string; first_published_at: number; content_published_at: number; excerpt_body_json: string | null }>();
  return results.map(row => ({
    id: row.id,
    title: row.published_title,
    summary: row.published_summary,
    body: row.excerpt_body_json ? JSON.parse(row.excerpt_body_json) as JSONContent : null,
    firstPublishedAt: row.first_published_at,
    contentPublishedAt: row.content_published_at,
  }));
}

// 公開側の一覧と同じ順に並べる。まだ公開していない記事は、作成日時をその代わりにする。
// 非公開に戻した記事は初回公開日時が残っているので、公開していたときの位置のままにする。
export async function listArticles(db: D1Database): Promise<ArticleListItem[]> {
  const { results } = await db.prepare(
    `SELECT id, title, status, created_at, first_published_at, updated_at, ${HAS_UNPUBLISHED_CHANGES} FROM articles ORDER BY COALESCE(first_published_at, created_at) DESC, id DESC`,
  ).all<Pick<ArticleRow, "id" | "title" | "status" | "first_published_at" | "updated_at" | "has_unpublished_changes"> & { created_at: number }>();
  return results.map(row => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    firstPublishedAt: row.first_published_at,
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
// 記事を消す。公開中でも消せる（公開ページは404になる）。アップロードした画像はR2に残る。
export async function deleteArticle(db: D1Database, id: string) {
  const result = await db.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export async function unpublishArticle(db: D1Database, id: string) {
  const result = await db.prepare(
    "UPDATE articles SET status = 'draft', published_title = NULL, published_summary = NULL, published_body_json = NULL, content_published_at = NULL WHERE id = ? AND status <> 'draft'",
  ).bind(id).run();
  return result.meta.changes > 0;
}
