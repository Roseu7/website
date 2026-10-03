import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { hasFormLegalConsent } from "~/utils/legal-consent.server";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { requireUmigameUser } from "~/utils/umigame/auth.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { createPuzzleSubmission, enqueuePuzzleReview, normalizePuzzleSubmission } from "~/utils/umigame/submission.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUmigameUser(request, context);
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const user = await requireUmigameUser(request, context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const legalConsent = hasFormLegalConsent(form);
  const raw = {
    title: form.get("title"),
    statement: form.get("statement"),
    canonicalTruth: form.get("canonicalTruth"),
    facts: form.get("facts"),
    hints: form.get("hints"),
    tags: form.getAll("tags"),
  };
  const values = {
    title: String(raw.title ?? ""),
    statement: String(raw.statement ?? ""),
    canonicalTruth: String(raw.canonicalTruth ?? ""),
    facts: String(raw.facts ?? ""),
    hints: String(raw.hints ?? ""),
    tags: raw.tags.map(String),
    legalConsent,
  };

  if (!legalConsent) {
    return data(
      {
        errors: [
          {
            field: "legalConsent",
            message: "利用規約とプライバシーポリシーへの同意が必要です。",
          },
        ],
        values,
      },
      { status: 400 },
    );
  }

  const normalized = normalizePuzzleSubmission(raw);

  if (normalized.errors.length > 0) {
    return data(
      {
        errors: normalized.errors,
        values,
      },
      { status: 400 },
    );
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);

  try {
    const created = await createPuzzleSubmission(db, user.id, normalized.value);
    await enqueuePuzzleReview(env, created.revisionId);
    return redirect("/games/umigame?submitted=1");
  } catch (error) {
    const message =
      error instanceof Response
        ? await error.text()
        : "問題を投稿できませんでした。もう一度試してください。";
    return data(
      {
        errors: [{ field: "form", message }],
        values: {
          title: normalized.value.title,
          statement: normalized.value.statement,
          canonicalTruth: normalized.value.canonicalTruth,
          facts: normalized.value.facts.join("\n"),
          hints: normalized.value.hints.join("\n"),
          tags: normalized.value.tags,
          legalConsent,
        },
      },
      { status: error instanceof Response ? error.status : 503 },
    );
  }
}
