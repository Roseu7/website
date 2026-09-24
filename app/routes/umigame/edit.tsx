import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { LegalConsentCheckbox } from "~/components/LegalConsentCheckbox";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import { hasFormLegalConsent } from "~/utils/legal-consent.server";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { requireUmigameUser } from "~/utils/umigame/auth.server";
import {
  formatPuzzlePublicId,
  parsePuzzlePublicId,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import {
  createPuzzleRevision,
  enqueuePuzzleReview,
  getEditablePuzzleSubmission,
  normalizePuzzleSubmission,
} from "~/utils/umigame/submission.server";
import { UMIGAME_AUTHOR_TAGS } from "~/utils/umigame/tags";
import { siteConfig } from "~/utils/site";
export const meta = () => [
  { title: `問題を編集 | ウミガメのスープ | ${siteConfig.fullName}` },
];

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

export default function UmigameEditPuzzlePage() {
  const { puzzle } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const errors = actionData?.errors ?? [];
  const values = actionData?.values;
  const selectedTags = new Set(values?.tags ?? puzzle.tags);
  const [legalConsentAccepted, setLegalConsentAccepted] = useState(false);
  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;
  const legalConsentError = legalConsentAccepted ? undefined : errorFor("legalConsent");

  useEffect(() => {
    if (values?.legalConsent !== undefined) {
      setLegalConsentAccepted(values.legalConsent);
    }
  }, [values?.legalConsent]);

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo={`/games/umigame/p/${puzzle.displayId}`} fallbackLabel="問題詳細に戻る" />

      <section className="umigame-submit-head">
        <h2>問題を編集</h2>
        <p>
          保存すると新しいrevisionを作成し、Jevの再審査に送ります。
          審査中は問題が一時的に公開一覧から外れます。
          すでに進行中のプレイは編集前のrevisionのまま継続します。
        </p>
      </section>

      <Form method="post" className="umigame-submit-form">
        {errorFor("form") ? (
          <p className="umigame-error" role="alert">{errorFor("form")}</p>
        ) : null}
        <label className="umigame-field">
          <span>タイトル</span>
          <input
            className="umigame-input"
            name="title"
            maxLength={100}
            defaultValue={values?.title ?? puzzle.title}
            required
          />
          {errorFor("title") ? (
            <small className="umigame-field-error">{errorFor("title")}</small>
          ) : null}
        </label>

        <label className="umigame-field">
          <span>問題文</span>
          <textarea
            className="umigame-textarea umigame-submit-textarea"
            name="statement"
            rows={6}
            maxLength={2000}
            defaultValue={values?.statement ?? puzzle.statement}
            required
          />
          {errorFor("statement") ? (
            <small className="umigame-field-error">{errorFor("statement")}</small>
          ) : null}
        </label>
        <label className="umigame-field">
          <span>真相</span>
          <textarea
            className="umigame-textarea umigame-submit-textarea"
            name="canonicalTruth"
            rows={8}
            maxLength={5000}
            defaultValue={values?.canonicalTruth ?? puzzle.canonicalTruth}
            required
          />
          {errorFor("canonicalTruth") ? (
            <small className="umigame-field-error">{errorFor("canonicalTruth")}</small>
          ) : null}
        </label>

        <label className="umigame-field">
          <span>重要事実</span>
          <small className="umigame-field-help">
            正解に最低限含まれてほしい内容を、1行につき1件入力。
          </small>
          <textarea
            className="umigame-textarea umigame-submit-textarea"
            name="facts"
            rows={6}
            defaultValue={values?.facts ?? puzzle.facts.join("\n")}
            required
          />
          {errorFor("facts") ? (
            <small className="umigame-field-error">{errorFor("facts")}</small>
          ) : null}
        </label>

        <label className="umigame-field">
          <span>ヒント（任意）</span>
          <small className="umigame-field-help">
            弱いヒントから順に、1行につき1件。最大5件。
          </small>
          <textarea
            className="umigame-textarea umigame-submit-textarea"
            name="hints"
            rows={5}
            defaultValue={values?.hints ?? puzzle.hints.join("\n")}
          />
          {errorFor("hints") ? (
            <small className="umigame-field-error">{errorFor("hints")}</small>
          ) : null}
        </label>

        <fieldset className="umigame-fieldset umigame-submit-tags">
          <legend>タグ候補（任意）</legend>
          <small className="umigame-field-help">
            真相の手掛かりにならない、遊ぶ分量や対象だけを選択。
          </small>
          <div className="umigame-tag-options">
            {UMIGAME_AUTHOR_TAGS.map((tag) => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.id}
                  defaultChecked={selectedTags.has(tag.id)}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
          {errorFor("tags") ? <small className="umigame-field-error">{errorFor("tags")}</small> : null}
        </fieldset>

        <LegalConsentCheckbox
          id="umigame-edit-legal-consent"
          checked={legalConsentAccepted}
          onChange={setLegalConsentAccepted}
          error={legalConsentError}
        />

        <div className="umigame-submit-actions">
          <button
            type="submit"
            className="btn site-button"
            disabled={pending || !legalConsentAccepted}
          >
            {pending ? "保存中…" : "保存して再審査"}
          </button>
        </div>
      </Form>
    </PageLayout>
  );
}
