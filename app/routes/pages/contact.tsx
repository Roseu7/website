import * as React from "react";
import { OsWindowActiveContext, useOsPage } from "~/components/os/OsContext";

import { Link, useActionData, useLoaderData, useFetcher, useRouteLoaderData } from "~/framework/navigation";

import { PageIntro } from "~/components/layout/PageIntro";

import { PageLayout } from "~/components/layout/PageLayout";

import { LegalConsentCheckbox } from "~/components/LegalConsentCheckbox";

import { siteConfig } from "~/utils/site";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "auto" | "light";
          size: "normal" | "compact";
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
  { name: "description", content: "R OS.3uへのお問い合わせフォームです。" },
];

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
  const osPage = useOsPage();

  React.useEffect(() => {
    let disposed = false;
    let script: HTMLScriptElement | null = null;
    let renderedSize: "normal" | "compact" | null = null;
    let generation = 0;
    const render = () => {
      const container = containerRef.current;
      if (disposed || !container || !container.clientWidth) return;
      const size = container.clientWidth < 300 ? "compact" : "normal";
      container.dataset.size = size;
      const turnstile = window.turnstile;
      if (!turnstile || (widgetIdRef.current && renderedSize === size)) return;
      if (widgetIdRef.current) { turnstile.remove(widgetIdRef.current); onToken(""); }
      renderedSize = size;
      const current = ++generation;
      const updateToken = (token: string) => { if (!disposed && current === generation) onToken(token); };
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        action: "contact",
        theme: osPage ? "light" : "auto",
        size,
        callback: updateToken,
        "expired-callback": () => updateToken(""),
        "error-callback": () => updateToken(""),
      });
    };
    const resize = new ResizeObserver(render);
    if (containerRef.current) resize.observe(containerRef.current);

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
      resize.disconnect();
      existing?.removeEventListener("load", render);
      existing?.removeEventListener("error", handleError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [nonce, onToken, osPage, siteKey]);

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
  const windowActive = React.useContext(OsWindowActiveContext);
  const config = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData("root") as { legalBaseHref?: string } | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";
  const initialResult = useActionData<typeof action>();
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data ?? initialResult;
  const pending = fetcher.state !== "idle";
  const available = config.enabled && Boolean(config.siteKey);
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [legalConsentAccepted, setLegalConsentAccepted] = React.useState(false);
  const failure = result && !result.ok ? result : null;
  const failureAttemptId = failure?.attemptId;

  React.useEffect(() => { if (!windowActive) setTurnstileToken(""); }, [windowActive]);

  React.useEffect(() => {
    if (failureAttemptId) setTurnstileToken("");
  }, [failureAttemptId]);

  return (
    <PageLayout contentClassName="page-stack legal-document os-contact-page">
      <PageIntro title="お問い合わせ" hideInOs />

      <section className="legal-section">
        <p>
          サイトや機能についての連絡、個人情報に関する相談を受け付けています。
          返信先のメールアドレスは、お問い合わせへの返信と受付確認メールの送付に利用します。
        </p>
        <p>
          <Link to={`${legalBaseHref}/privacy`}>プライバシーポリシー</Link>を確認のうえ、お問い合わせに必要な情報を入力してください。
        </p>
      </section>

      {result?.ok ? (
        <p className="contact-status contact-status--success" role="status">
          お問い合わせを受け付けました。内容を確認して返信します。
        </p>
      ) : (
        <fetcher.Form
          action="/contact"
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

          {available && config.siteKey && windowActive && <TurnstileChallenge
            siteKey={config.siteKey}
            nonce={config.nonce}
            onToken={setTurnstileToken}
          />}
          <input type="hidden" name="turnstileToken" value={turnstileToken} />

          <LegalConsentCheckbox
            id="contact-legal-consent"
            checked={legalConsentAccepted}
            onChange={setLegalConsentAccepted}
          >
            入力情報を問い合わせ対応・受付確認メールに利用することにも<span className="legal-consent__phrase">同意します。</span>
          </LegalConsentCheckbox>

          {failure ? (
            <p className="contact-status contact-status--error" role="alert">{failure.error}</p>
          ) : null}

          <button
            type="submit"
            className="btn site-button"
            disabled={!available || pending || !legalConsentAccepted}
          >
            {pending ? "送信しています..." : "送信する"}
          </button>
        </fetcher.Form>
      )}
    </PageLayout>
  );
}
import type { loader, action } from './contact.server';
