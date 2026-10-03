import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";

import { hasFormLegalConsent } from "~/utils/legal-consent.server";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { requireUmigameUser } from "~/utils/umigame/auth.server";

import { formatPuzzlePublicId, parsePuzzlePublicId } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

import { createPuzzleRevision, enqueuePuzzleReview, getEditablePuzzleSubmission, normalizePuzzleSubmission } from "~/utils/umigame/submission.server";

function parseCanonicalPublicId(rawId: string) {
  const publicId = parsePuzzlePublicId(rawId);
  if (!publicId || rawId !== formatPuzzlePublicId(publicId)) {
    throw new Response("Not Found", { status: 404 });
  }
  return publicId;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const publicId = parseCanonicalPublicId(params.id?.trim() ?? "");
  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getEditablePuzzleSubmission(db, publicId, user.id);
  if (!puzzle) throw new Response("Not Found", { status: 404 });
  return { puzzle };
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const user = await requireUmigameUser(request, context);
  const publicId = parseCanonicalPublicId(params.id?.trim() ?? "");
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const existing = await getEditablePuzzleSubmission(db, publicId, user.id);
  if (!existing) throw new Response("Not Found", { status: 404 });

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
  try {
    const updated = await createPuzzleRevision(db, publicId, user.id, normalized.value);
    await enqueuePuzzleReview(env, updated.revisionId);
    return redirect("/games/umigame?edited=1");
  } catch (error) {
    const message =
      error instanceof Response
        ? await error.text()
        : "問題を更新できませんでした。もう一度試してください。";
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
