import * as React from "react";
import {
  data,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { LegalConsentCheckbox } from "~/components/LegalConsentCheckbox";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { readLimitedFormData } from "~/utils/request-body.server";
import {
  CONTACT_BODY_LIMIT,
  EMPTY_CONTACT_VALUES,
  getContactEnvironment,
  isContactConfigured,
  submitContact,
  type ContactActionData,
} from "~/utils/contact.server";
import { siteConfig } from "~/utils/site";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "auto";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export const meta = () => [
  { title: `お問い合わせ | ${siteConfig.fullName}` },
  { name: "description", content: "Digital Sandboxへのお問い合わせフォームです。" },
];

export async function loader({ context, request }: LoaderFunctionArgs) {
  const env = getContactEnvironment(context);
  const hostname = new URL(request.url).hostname.toLowerCase();
  return {
    enabled: isContactConfigured(env) && (hostname === "roseu.net" || hostname === "www.roseu.net"),
    siteKey: env.CONTACT_TURNSTILE_SITE_KEY ?? null,
    nonce: context.cspNonce,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    return data<ContactActionData>(
      {
        ok: false,
        error: "フォームを読み取れませんでした。",
        attemptId: crypto.randomUUID(),
        values: EMPTY_CONTACT_VALUES,
      },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }

  const form = await readLimitedFormData(request, CONTACT_BODY_LIMIT);
  const result = await submitContact(form, request, getContactEnvironment(context));
  return data(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}

function TurnstileChallenge({
  siteKey,
  nonce,
  onToken,
}: {
  siteKey: string;
  nonce: string;
  onToken: React.Dispatch<React.SetStateAction<string>>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let script: HTMLScriptElement | null = null;
    const render = () => {
      const container = containerRef.current;
      const turnstile = window.turnstile;
      if (disposed || !container || !turnstile || widgetIdRef.current) return;
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        action: "contact",
        theme: "auto",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    const handleError = () => onToken("");
    let existing = document.getElementById("cloudflare-turnstile-api") as HTMLScriptElement | null;
    if (window.turnstile) {
      render();
    } else {
      if (!existing) {
        script = document.createElement("script");
        script.id = "cloudflare-turnstile-api";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.nonce = nonce;
        existing = script;
      }
      existing.addEventListener("load", render);
      existing.addEventListener("error", handleError);
      if (script) document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      existing?.removeEventListener("load", render);
      existing?.removeEventListener("error", handleError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [nonce, onToken, siteKey]);

  return (
    <div
      ref={containerRef}
      className="contact-turnstile"
      role="group"
      aria-label="Cloudflare Turnstileによる本人確認"
    />
  );
}

export default function ContactPage() {
  const config = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { legalBaseHref?: string } | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [legalConsentAccepted, setLegalConsentAccepted] = React.useState(false);
  const failure = result && !result.ok ? result : null;
  const failureAttemptId = failure?.attemptId;

  React.useEffect(() => {
    if (failureAttemptId) setTurnstileToken("");
  }, [failureAttemptId]);

  return (
    <PageLayout contentClassName="page-stack legal-document">
      <PageIntro title="お問い合わせ" />

      <section className="legal-section">
        <p>
          サイトや機能についての連絡、個人情報に関する相談を受け付けています。
          返信先のメールアドレスは問い合わせへの返信と受付確認メールに使い、ページ上には公開しません。
        </p>
        <p>
          <Link to={`${legalBaseHref}/privacy`}>プライバシーポリシー</Link>を確認のうえ送信してください。パスワードや認証コードなどの秘密情報は入力しないでください。
        </p>
      </section>

      {result?.ok ? (
        <p className="contact-status contact-status--success" role="status">
          お問い合わせを受け付けました。内容を確認して返信します。
        </p>
      ) : config.enabled && config.siteKey ? (
        <Form
          key={failure?.attemptId ?? "contact-form"}
          method="post"
          className="contact-form"
          aria-busy={pending}
        >
          <div className="contact-field">
            <label htmlFor="contact-name">お名前（任意）</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              maxLength={80}
              autoComplete="name"
              defaultValue={failure?.values.name ?? ""}
            />
          </div>

          <div className="contact-field">
            <label htmlFor="contact-email">返信先メールアドレス <span aria-hidden="true">*</span></label>
            <input
              id="contact-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              defaultValue={failure?.values.email ?? ""}
            />
            <small>送信後、このアドレスにお問い合わせ内容を記載した受付確認メールを送ります。</small>
          </div>

          <div className="contact-field">
            <label htmlFor="contact-topic">お問い合わせの種類</label>
            <select id="contact-topic" name="topic" defaultValue={failure?.values.topic ?? "general"}>
              <option value="general">一般的なお問い合わせ</option>
              <option value="technical">サイト・機能について</option>
              <option value="privacy">個人情報について</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div className="contact-field">
            <label htmlFor="contact-message">お問い合わせ内容 <span aria-hidden="true">*</span></label>
            <textarea
              id="contact-message"
              name="message"
              rows={8}
              maxLength={3000}
              required
              defaultValue={failure?.values.message ?? ""}
            />
            <small>最大3,000文字</small>
          </div>

          <div className="contact-trap" aria-hidden="true">
            <label htmlFor="contact-company-website">この欄には入力しないでください</label>
            <input
              id="contact-company-website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <TurnstileChallenge
            siteKey={config.siteKey}
            nonce={config.nonce}
            onToken={setTurnstileToken}
          />
          <input type="hidden" name="turnstileToken" value={turnstileToken} />

          <LegalConsentCheckbox
            id="contact-legal-consent"
            checked={legalConsentAccepted}
            onChange={setLegalConsentAccepted}
          >
            入力情報を問い合わせ対応・受付確認メールに利用することにも同意します。
          </LegalConsentCheckbox>

          {failure ? (
            <p className="contact-status contact-status--error" role="alert">{failure.error}</p>
          ) : null}

          <button
            type="submit"
            className="btn site-button"
            disabled={pending || !legalConsentAccepted}
          >
            {pending ? "送信しています..." : "送信する"}
          </button>
        </Form>
      ) : (
        <p className="contact-status" role="status">
          お問い合わせフォームは現在準備中です。
        </p>
      )}
    </PageLayout>
  );
}
