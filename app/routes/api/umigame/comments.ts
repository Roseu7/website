import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { readLimitedJson } from "~/utils/request-body.server";
import { hasLegalConsent } from "~/utils/legal-consent.server";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import {
  createPuzzleComment,
  enqueueCommentReview,
  listPuzzleComments,
} from "~/utils/umigame/comments.server";
import {
  getPublishedRevisionForPublicId,
  parsePuzzlePublicId,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";

const MAX_BODY_BYTES = 8 * 1024;

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const revision = await getPublishedRevisionForPublicId(db, publicId);
  if (!revision) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }

  const user = await getOptionalUmigameUser(request, context);
  const comments = await listPuzzleComments(db, revision.puzzleId, user?.id ?? null);
  return jsonNoStore({ comments });
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePost(request);
  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }

  const user = await getOptionalUmigameUser(request, context);
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "コメントの投稿にはログインが必要です。");
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch {
    return jsonError(400, "INVALID_JSON", "コメントを読み取れませんでした。");
  }
  const legalConsent =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { legalConsent?: unknown }).legalConsent
      : null;
  if (!hasLegalConsent(legalConsent)) {
    return jsonError(
      400,
      "LEGAL_CONSENT_REQUIRED",
      "利用規約とプライバシーポリシーへの同意が必要です。",
    );
  }

  const text =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { text?: unknown }).text
      : null;
  if (typeof text !== "string" || text.trim().length < 1 || text.trim().length > 2000) {
    return jsonError(400, "INVALID_COMMENT", "コメントは1〜2000文字で入力してください。");
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const revision = await getPublishedRevisionForPublicId(db, publicId);
  if (!revision) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }

  try {
    const commentId = await createPuzzleComment(db, {
      puzzleId: revision.puzzleId,
      revisionId: revision.revisionId,
      authorUserId: user.id,
      body: text,
    });
    const reviewMode = await enqueueCommentReview(env, commentId);
    return jsonNoStore(
      {
        commentId,
        status: "pending",
        reviewMode,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Response) {
      return jsonError(
        error.status,
        error.status === 429 ? "RATE_LIMITED" : "COMMENT_REJECTED",
        await error.text(),
        error.status === 429,
      );
    }
    console.error("Umigame comment submission failed.", error);
    return jsonError(500, "COMMENT_FAILED", "コメントを投稿できませんでした。", true);
  }
}
