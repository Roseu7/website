import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import {
  getPublishedPuzzlePublicById,
  parsePuzzlePublicId,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { hasLegalConsent } from "~/utils/legal-consent.server";
import { readLimitedFormData, readLimitedJsonObject } from "~/utils/request-body.server";
import { jsonError, jsonNoStore, requirePut } from "~/utils/umigame/http.server";
import {
  createPuzzleRevision,
  enqueuePuzzleReview,
  getEditablePuzzleSubmission,
  normalizePuzzleSubmission,
} from "~/utils/umigame/submission.server";

const MAX_BODY_BYTES = 64 * 1024;

export async function loader({ params, context }: LoaderFunctionArgs) {
  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getPublishedPuzzlePublicById(db, publicId);
  if (!puzzle) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "問題が見つかりません。");
  }
  return jsonNoStore({ puzzle });
}
async function parseEditRequest(request: Request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return readLimitedJsonObject(request, MAX_BODY_BYTES);
  }

  const form = await readLimitedFormData(request, MAX_BODY_BYTES);
  return {
    title: form.get("title"),
    statement: form.get("statement"),
    canonicalTruth: form.get("canonicalTruth"),
    facts: form.get("facts"),
    hints: form.get("hints"),
    tags: form.getAll("tags"),
    legalConsent: form.getAll("legalConsent"),
  };
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requirePut(request);

  const user = await getOptionalUmigameUser(request, context);
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "問題の編集にはログインが必要です。");
  }

  const publicId = parsePuzzlePublicId(params.id?.trim() ?? "");
  if (!publicId) {
    return jsonError(400, "INVALID_PUZZLE_ID", "問題IDが不正です。");
  }
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const existing = await getEditablePuzzleSubmission(db, publicId, user.id);
  if (!existing) {
    return jsonError(404, "PUZZLE_NOT_FOUND", "編集できる問題が見つかりません。");
  }

  let raw: Record<string, unknown>;
  try {
    raw = await parseEditRequest(request);
  } catch (error) {
    if (error instanceof Response && error.status === 413) {
      return jsonError(413, "PAYLOAD_TOO_LARGE", "編集内容が大きすぎます。");
    }
    return jsonError(400, "INVALID_REQUEST", "編集内容を読み取れませんでした。");
  }

  if (!hasLegalConsent(raw.legalConsent)) {
    return jsonError(
      400,
      "LEGAL_CONSENT_REQUIRED",
      "利用規約とプライバシーポリシーへの同意が必要です。",
    );
  }

  const normalized = normalizePuzzleSubmission(raw);
  if (normalized.errors.length > 0) {
    return jsonNoStore(
      {
        error: {
          code: "INVALID_PUZZLE",
          message: normalized.errors[0].message,
          retryable: false,
        },
        fieldErrors: normalized.errors,
      },
      400,
    );
  }
  try {
    const updated = await createPuzzleRevision(db, publicId, user.id, normalized.value);
    const reviewMode = await enqueuePuzzleReview(env, updated.revisionId);
    return jsonNoStore(
      {
        ...updated,
        status: "pending_review",
        reviewMode,
      },
      202,
    );
  } catch (error) {
    if (error instanceof Response) {
      return jsonError(
        error.status || 400,
        "PUZZLE_EDIT_FAILED",
        await error.text(),
        error.status >= 500,
      );
    }

    console.error("Umigame puzzle edit failed.", error);
    return jsonError(
      503,
      "PUZZLE_EDIT_FAILED",
      "問題を更新できませんでした。もう一度試してください。",
      true,
    );
  }
}
