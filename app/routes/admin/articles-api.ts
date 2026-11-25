import type { ActionFunctionArgs } from "~/framework/http";
import { requireArticlesAdmin } from "~/utils/articles/auth.server";
import {
  ArticleContentError,
  MAX_BODY_JSON_BYTES,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  isArticleId,
  validateArticleBody,
  validateTags,
} from "~/utils/articles/content";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import {
  deleteArticle,
  publishArticle,
  saveDraft,
  setVisibility,
  unpublishArticle,
  type ArticleDraft,
  type ArticleStatus,
  type PublishMode,
  type WriteResult,
} from "~/utils/articles/store.server";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { readLimitedJsonObject } from "~/utils/request-body.server";
import { jsonError, jsonNoStore } from "~/utils/umigame/http.server";

// 本文の上限にタイトル・概要・操作名の分を足した大きさ。
const MAX_REQUEST_BYTES = MAX_BODY_JSON_BYTES + 16 * 1024;

function parseDraft(body: Record<string, unknown>): ArticleDraft {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (title.length > MAX_TITLE_LENGTH) throw new ArticleContentError(`タイトルは${MAX_TITLE_LENGTH}文字までです。`);
  if (summary.length > MAX_SUMMARY_LENGTH) throw new ArticleContentError(`概要は${MAX_SUMMARY_LENGTH}文字までです。`);
  const normalized = validateArticleBody(body.body);
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BODY_JSON_BYTES) {
    throw new ArticleContentError("本文が長すぎます。");
  }
  return { title, summary, body: normalized, tags: validateTags(body.tags) };
}

function isPublicStatus(value: unknown): value is Exclude<ArticleStatus, "draft"> {
  return value === "unlisted" || value === "published";
}

function parseRevision(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new ArticleContentError("版番号が正しくありません。");
  return value as number;
}

function writeResponse(result: WriteResult) {
  if (result.ok) return jsonNoStore({ revision: result.revision, updatedAt: result.updatedAt, hasUnpublishedChanges: result.hasUnpublishedChanges });
  if (result.reason === "conflict") {
    return jsonNoStore({ error: { code: "CONFLICT", message: "ほかの画面で先に保存されています。" }, revision: result.revision }, 409);
  }
  if (result.reason === "status_changed") {
    return jsonNoStore({ error: { code: "STATUS_CHANGED", message: "公開の状態がほかの画面で変わっています。ページを読み込み直してください。" }, status: result.status }, 409);
  }
  return jsonError(404, "NOT_FOUND", "記事が見つかりません。");
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  await requireArticlesAdmin(request, context);
  const id = params.id ?? "";
  if (!isArticleId(id)) return jsonError(404, "NOT_FOUND", "記事が見つかりません。");
  const db = requireArticlesDb(getArticlesEnv(context));

  let body: Record<string, unknown>;
  try {
    body = await readLimitedJsonObject(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof Response && error.status === 413) return jsonError(413, "TOO_LARGE", "本文が長すぎます。");
    return jsonError(400, "INVALID_JSON", "送信内容を読み取れませんでした。");
  }

  try {
    switch (body.op) {
      case "save":
        return writeResponse(await saveDraft(db, id, parseRevision(body.revision), parseDraft(body)));
      case "publish": {
        let mode: PublishMode;
        if (body.mode === "update") mode = { kind: "update" };
        else if (body.mode === "first" && isPublicStatus(body.status)) mode = { kind: "first", status: body.status };
        else return jsonError(400, "INVALID_STATUS", "公開の種類が正しくありません。");
        return writeResponse(await publishArticle(db, id, parseRevision(body.revision), parseDraft(body), mode));
      }
      case "visibility": {
        if (!isPublicStatus(body.from) || !isPublicStatus(body.status)) return jsonError(400, "INVALID_STATUS", "公開の種類が正しくありません。");
        return (await setVisibility(db, id, body.from, body.status))
          ? jsonNoStore({ status: body.status })
          : jsonError(409, "STATUS_CHANGED", "公開の状態がほかの画面で変わっています。ページを読み込み直してください。");
      }
      case "delete":
        return (await deleteArticle(db, id))
          ? jsonNoStore({ deleted: true })
          : jsonError(404, "NOT_FOUND", "記事が見つかりません。");
      case "unpublish":
        return (await unpublishArticle(db, id))
          ? jsonNoStore({ status: "draft" })
          : jsonError(409, "NOT_PUBLISHED", "公開していない記事です。");
      default:
        return jsonError(400, "INVALID_OP", "操作が正しくありません。");
    }
  } catch (error) {
    if (error instanceof ArticleContentError) return jsonError(422, "INVALID_CONTENT", error.message);
    throw error;
  }
}
