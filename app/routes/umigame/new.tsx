import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { LegalConsentCheckbox } from "~/components/LegalConsentCheckbox";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import { hasFormLegalConsent } from "~/utils/legal-consent.server";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { requireUmigameUser } from "~/utils/umigame/auth.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import {
  createPuzzleSubmission,
  enqueuePuzzleReview,
  normalizePuzzleSubmission,
} from "~/utils/umigame/submission.server";
import { UMIGAME_AUTHOR_TAGS } from "~/utils/umigame/tags";
import { siteConfig } from "~/utils/site";

const REQUIRED_SUBMISSION_FIELDS = [
  { name: "title", id: "umigame-submit-title" },
  { name: "statement", id: "umigame-submit-statement" },
  { name: "canonicalTruth", id: "umigame-submit-truth" },
  { name: "facts", id: "umigame-submit-facts" },
] as const;

type RequiredSubmissionField = (typeof REQUIRED_SUBMISSION_FIELDS)[number]["name"];

function joinDescribedBy(...ids: Array<string | undefined>) {
  return ids.filter((id): id is string => Boolean(id)).join(" ") || undefined;
}

export const meta = () => [
  { title: `問題を投稿 | ウミガメのスープ | ${siteConfig.fullName}` },
];

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

export default function UmigameNewPuzzlePage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const errors = actionData?.errors ?? [];
  const values = actionData?.values;
  const selectedTags = new Set(values?.tags ?? []);
  const [legalConsentAccepted, setLegalConsentAccepted] = useState(false);
  const [localLegalConsentError, setLocalLegalConsentError] = useState<string | null>(null);
  const [missingRequiredField, setMissingRequiredField] =
    useState<RequiredSubmissionField | null>(null);

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;
  const titleError = errorFor("title");
  const statementError = errorFor("statement");
  const truthError = errorFor("canonicalTruth");
  const factsError = errorFor("facts");
  const hintsError = errorFor("hints");
  const tagsError = errorFor("tags");
  const legalConsentError = legalConsentAccepted
    ? undefined
    : errorFor("legalConsent") ?? localLegalConsentError ?? undefined;

  useEffect(() => {
    if (values?.legalConsent !== undefined) {
      setLegalConsentAccepted(values.legalConsent);
    }
  }, [values?.legalConsent]);

  useEffect(() => {
    if (!missingRequiredField) return;

    const field = REQUIRED_SUBMISSION_FIELDS.find(
      ({ name }) => name === missingRequiredField,
    );
    const control = field ? document.getElementById(field.id) : null;
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
      return;
    }

    control.focus({ preventScroll: true });
    control.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, [missingRequiredField]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const missingField = REQUIRED_SUBMISSION_FIELDS.find(({ name }) => {
      const control = form.elements.namedItem(name);
      return (
        (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) &&
        control.value.trim().length === 0
      );
    });

    setMissingRequiredField(missingField?.name ?? null);
    if (missingField) {
      event.preventDefault();
      return;
    }

    const consentControl = form.elements.namedItem("legalConsent");
    if (!(consentControl instanceof HTMLInputElement) || !consentControl.checked) {
      event.preventDefault();
      setLocalLegalConsentError(
        "利用規約とプライバシーポリシーへの同意が必要です。",
      );
      const checkbox = document.getElementById("umigame-submit-legal-consent");
      if (checkbox instanceof HTMLInputElement) {
        checkbox.focus({ preventScroll: true });
        checkbox.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center",
        });
      }
      return;
    }

    setLocalLegalConsentError(null);
  };

  const handleRequiredFieldChange = (
    field: RequiredSubmissionField,
    value: string,
  ) => {
    if (missingRequiredField === field && value.trim().length > 0) {
      setMissingRequiredField(null);
    }
  };

  const titleRequiredError = missingRequiredField === "title";
  const statementRequiredError = missingRequiredField === "statement";
  const truthRequiredError = missingRequiredField === "canonicalTruth";
  const factsRequiredError = missingRequiredField === "facts";

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-submit-head">
        <h2>問題を投稿</h2>
        <p>
          投稿後、AIが問題の整合性・公平性・難易度などを確認します。
          <br />
          問題がなければ自動で公開され、判断が必要な場合は管理者の確認待ちになります。
        </p>
      </section>

      <Form method="post" noValidate className="umigame-submit-form" onSubmit={handleSubmit}>
        {errorFor("form") ? (
          <p className="umigame-error" role="alert">{errorFor("form")}</p>
        ) : null}

        <div className="umigame-field">
          <label className="umigame-field__label" htmlFor="umigame-submit-title">
            タイトル
            <span className="umigame-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="umigame-submit-title"
            className="umigame-input"
            name="title"
            maxLength={100}
            defaultValue={values?.title ?? ""}
            required
            onChange={(event) => handleRequiredFieldChange("title", event.currentTarget.value)}
            aria-invalid={titleError || titleRequiredError ? true : undefined}
            aria-describedby={joinDescribedBy(
              titleError ? "umigame-submit-title-error" : undefined,
              titleRequiredError ? "umigame-submit-title-required-error" : undefined,
            )}
          />
          {titleRequiredError ? (
            <small
              id="umigame-submit-title-required-error"
              className="umigame-required-error"
            >
              この項目は入力が必須です
            </small>
          ) : null}
          {titleError && !titleRequiredError ? (
            <small id="umigame-submit-title-error" className="umigame-field-error">
              {titleError}
            </small>
          ) : null}
        </div>

        <div className="umigame-field">
          <label className="umigame-field__label" htmlFor="umigame-submit-statement">
            問題文
            <span className="umigame-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="umigame-submit-statement"
            className="umigame-textarea umigame-submit-textarea"
            name="statement"
            rows={6}
            maxLength={2000}
            defaultValue={values?.statement ?? ""}
            required
            onChange={(event) =>
              handleRequiredFieldChange("statement", event.currentTarget.value)
            }
            aria-invalid={statementError || statementRequiredError ? true : undefined}
            aria-describedby={joinDescribedBy(
              statementError ? "umigame-submit-statement-error" : undefined,
              statementRequiredError ? "umigame-submit-statement-required-error" : undefined,
            )}
          />
          {statementRequiredError ? (
            <small
              id="umigame-submit-statement-required-error"
              className="umigame-required-error"
            >
              この項目は入力が必須です
            </small>
          ) : null}
          {statementError && !statementRequiredError ? (
            <small id="umigame-submit-statement-error" className="umigame-field-error">
              {statementError}
            </small>
          ) : null}
        </div>

        <div className="umigame-field">
          <label className="umigame-field__label" htmlFor="umigame-submit-truth">
            真相
            <span className="umigame-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="umigame-submit-truth"
            className="umigame-textarea umigame-submit-textarea"
            name="canonicalTruth"
            rows={8}
            maxLength={5000}
            defaultValue={values?.canonicalTruth ?? ""}
            required
            onChange={(event) =>
              handleRequiredFieldChange("canonicalTruth", event.currentTarget.value)
            }
            aria-invalid={truthError || truthRequiredError ? true : undefined}
            aria-describedby={joinDescribedBy(
              truthError ? "umigame-submit-truth-error" : undefined,
              truthRequiredError ? "umigame-submit-truth-required-error" : undefined,
            )}
          />
          {truthRequiredError ? (
            <small
              id="umigame-submit-truth-required-error"
              className="umigame-required-error"
            >
              この項目は入力が必須です
            </small>
          ) : null}
          {truthError && !truthRequiredError ? (
            <small id="umigame-submit-truth-error" className="umigame-field-error">
              {truthError}
            </small>
          ) : null}
        </div>

        <div className="umigame-field">
          <label className="umigame-field__label" htmlFor="umigame-submit-facts">
            重要事実
            <span className="umigame-field__required" aria-hidden="true">*</span>
          </label>
          <small id="umigame-submit-facts-help" className="umigame-field-help">
            正解に最低限含まれてほしい内容を、1行につき1件入力してください。
          </small>
          <textarea
            id="umigame-submit-facts"
            className="umigame-textarea umigame-submit-textarea"
            name="facts"
            rows={6}
            defaultValue={values?.facts ?? ""}
            placeholder={"電話の一度切りは危険を知らせる合図だった。\n店の正面に避けるべき危険があった。"}
            required
            onChange={(event) => handleRequiredFieldChange("facts", event.currentTarget.value)}
            aria-invalid={factsError || factsRequiredError ? true : undefined}
            aria-describedby={joinDescribedBy(
              "umigame-submit-facts-help",
              factsError && !factsRequiredError ? "umigame-submit-facts-error" : undefined,
              factsRequiredError ? "umigame-submit-facts-required-error" : undefined,
            )}
          />
          {factsRequiredError ? (
            <small
              id="umigame-submit-facts-required-error"
              className="umigame-required-error"
            >
              この項目は入力が必須です
            </small>
          ) : null}
          {factsError && !factsRequiredError ? (
            <small id="umigame-submit-facts-error" className="umigame-field-error">
              {factsError}
            </small>
          ) : null}
        </div>

        <div className="umigame-field">
          <label className="umigame-field__label" htmlFor="umigame-submit-hints">
            ヒント
          </label>
          <small id="umigame-submit-hints-help" className="umigame-field-help">
            弱いヒントから順に記入してください。1行につき1ヒントになります。(最大5ヒント)
          </small>
          <textarea
            id="umigame-submit-hints"
            className="umigame-textarea umigame-submit-textarea"
            name="hints"
            rows={5}
            defaultValue={values?.hints ?? ""}
            aria-invalid={hintsError ? true : undefined}
            aria-describedby={
              hintsError
                ? "umigame-submit-hints-help umigame-submit-hints-error"
                : "umigame-submit-hints-help"
            }
          />
          {hintsError ? (
            <small id="umigame-submit-hints-error" className="umigame-field-error">
              {hintsError}
            </small>
          ) : null}
        </div>

        <fieldset
          className="umigame-fieldset umigame-submit-tags"
          aria-describedby={
            tagsError
              ? "umigame-submit-tags-error"
              : undefined
          }
        >
          <legend>タグ候補</legend>
          <div className="umigame-tag-options">
            {UMIGAME_AUTHOR_TAGS.map((tag) => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  name="tags"
                  value={tag.id}
                  defaultChecked={selectedTags.has(tag.id)}
                  aria-invalid={tagsError ? true : undefined}
                  aria-describedby={tagsError ? "umigame-submit-tags-error" : undefined}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
          {tagsError ? (
            <small id="umigame-submit-tags-error" className="umigame-field-error">
              {tagsError}
            </small>
          ) : null}
        </fieldset>

        <LegalConsentCheckbox
          id="umigame-submit-legal-consent"
          checked={legalConsentAccepted}
          onChange={(checked) => {
            setLegalConsentAccepted(checked);
            if (checked) setLocalLegalConsentError(null);
          }}
          error={legalConsentError}
        />

        <div className="umigame-submit-actions">
          <button
            type="submit"
            className="btn site-button"
            disabled={pending || !legalConsentAccepted}
          >
            {pending ? "投稿中…" : "投稿する"}
          </button>
        </div>
      </Form>
    </PageLayout>
  );
}
