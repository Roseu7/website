import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import { listPublishedPuzzles } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { readLimitedFormData, readLimitedJsonObject } from "~/utils/request-body.server";
import { hasLegalConsent } from "~/utils/legal-consent.server";
import { jsonError, jsonNoStore, requirePost } from "~/utils/umigame/http.server";
import {
  createPuzzleSubmission,
  enqueuePuzzleReview,
  normalizePuzzleSubmission,
} from "~/utils/umigame/submission.server";

const MAX_BODY_BYTES = 64 * 1024;

export async function loader({ context }: LoaderFunctionArgs) {
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const puzzles = await listPublishedPuzzles(db);
  return jsonNoStore({ puzzles });
}

async function parseSubmissionRequest(request: Request) {
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

export async function action({ request, context }: ActionFunctionArgs) {
  requirePost(request);

  const user = await getOptionalUmigameUser(request, context);
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "問題の投稿にはログインが必要です。");
  }

  let raw: Record<string, unknown>;
  try {
    raw = await parseSubmissionRequest(request);
  } catch (error) {
    if (error instanceof Response && error.status === 413) {
      return jsonError(413, "PAYLOAD_TOO_LARGE", "投稿内容が大きすぎます。");
    }
    return jsonError(400, "INVALID_REQUEST", "投稿内容を読み取れませんでした。");
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

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);

  try {
    const created = await createPuzzleSubmission(db, user.id, normalized.value);
    const reviewMode = await enqueuePuzzleReview(env, created.revisionId);

    return jsonNoStore(
      {
        ...created,
        status: "pending_review",
        reviewMode,
      },
      202,
    );
  } catch (error) {
    if (error instanceof Response) {
      return jsonError(
        error.status || 400,
        error.status === 429 ? "SUBMISSION_RATE_LIMITED" : "SUBMISSION_FAILED",
        await error.text(),
        error.status >= 500,
      );
    }

    console.error("Umigame puzzle submission failed.", error);
    return jsonError(
      503,
      "SUBMISSION_FAILED",
      "問題を投稿できませんでした。もう一度試してください。",
      true,
    );
  }
}
