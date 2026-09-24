import type { AppLoadContext } from "react-router";
import { hasFormLegalConsent } from "~/utils/legal-consent.server";

export const CONTACT_BODY_LIMIT = 8 * 1024;
export const CONTACT_MAX_MESSAGE_LENGTH = 3000;
export const CONTACT_ACTION_NAME = "contact";

export interface ContactEnvironment {
  CONTACT_FROM?: string;
  CONTACT_TO?: string;
  CONTACT_RATE_LIMITER?: RateLimit;
  RESEND_API_KEY?: string;
  CONTACT_TURNSTILE_SECRET?: string;
  CONTACT_TURNSTILE_SITE_KEY?: string;
}

export interface ContactFormValues {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export type ContactActionData =
  | { ok: true }
  | {
      ok: false;
      error: string;
      attemptId: string;
      values: ContactFormValues;
    };

export const EMPTY_CONTACT_VALUES: ContactFormValues = {
  name: "",
  email: "",
  topic: "general",
  message: "",
};

const encoder = new TextEncoder();
const TOPICS = new Map([
  ["general", "一般的なお問い合わせ"],
  ["technical", "サイト・機能について"],
  ["privacy", "個人情報について"],
  ["other", "その他"],
]);
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const DISALLOWED_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export function getContactEnvironment(context: AppLoadContext): ContactEnvironment {
  return context.cloudflare.env as unknown as ContactEnvironment;
}

export function isContactConfigured(env: ContactEnvironment): boolean {
  return Boolean(
    env.RESEND_API_KEY &&
      env.CONTACT_FROM &&
      env.CONTACT_TO &&
      env.CONTACT_RATE_LIMITER &&
      env.CONTACT_TURNSTILE_SECRET &&
      env.CONTACT_TURNSTILE_SITE_KEY,
  );
}

function readSingleString(form: FormData, name: string): string | null {
  const entries = form.getAll(name);
  if (entries.length !== 1 || typeof entries[0] !== "string") return null;
  return entries[0];
}

function characterCount(value: string): number {
  return [...value].length;
}

function isSafeShortText(value: string): boolean {
  return !DISALLOWED_CONTROLS.test(value) && !/[\r\n]/u.test(value);
}

function getClientIp(request: Request): string | null {
  const raw = request.headers.get("CF-Connecting-IP")?.trim();
  if (raw) {
    if (raw.length > 45 || /[\s,%]/u.test(raw)) return null;
    const ipv4 = raw.split(".");
    if (
      ipv4.length === 4 &&
      ipv4.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
    ) {
      return `ipv4:${ipv4.map(Number).join(".")}`;
    }
    try {
      const hostname = new URL(`http://[${raw}]/`).hostname;
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        return `ipv6:${hostname.slice(1, -1).toLowerCase()}`;
      }
    } catch {
      return null;
    }
    return null;
  }

  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    ? `local:${hostname}`
    : null;
}

async function hashRateLimitIp(secret: string, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`contact\0${ip}`),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getFormValues(form: FormData): ContactFormValues | null {
  const name = readSingleString(form, "name");
  const email = readSingleString(form, "email");
  const topic = readSingleString(form, "topic");
  const message = readSingleString(form, "message");
  if (name === null || email === null || topic === null || message === null) return null;
  return {
    name: name.trim(),
    email: email.trim(),
    topic,
    message: message.replace(/\r\n?/gu, "\n").trim(),
  };
}

function validateValues(values: ContactFormValues, form: FormData): string | null {
  const honeypot = readSingleString(form, "company_website");
  if (honeypot === null) return "フォームを読み取れませんでした。";
  if (!hasFormLegalConsent(form)) {
    return "利用規約とプライバシーポリシーへの同意が必要です。";
  }
  if (!values.email || values.email.length > 254 || !EMAIL_PATTERN.test(values.email)) {
    return "返信先メールアドレスを正しく入力してください。";
  }
  if (!isSafeShortText(values.name) || characterCount(values.name) > 80) {
    return "お名前は80文字以内で入力してください。";
  }
  if (!TOPICS.has(values.topic)) return "お問い合わせの種類を選び直してください。";
  if (
    !values.message ||
    characterCount(values.message) > CONTACT_MAX_MESSAGE_LENGTH ||
    DISALLOWED_CONTROLS.test(values.message)
  ) {
    return `お問い合わせ内容は1〜${CONTACT_MAX_MESSAGE_LENGTH}文字で入力してください。`;
  }
  return null;
}

async function verifyTurnstile(
  token: string,
  secret: string,
  request: Request,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;

  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname !== "roseu.net" && hostname !== "www.roseu.net") return false;

  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) return false;

  const result = await response.json() as {
    success?: unknown;
    hostname?: unknown;
    action?: unknown;
  };
  return result.success === true &&
    typeof result.hostname === "string" &&
    result.hostname.toLowerCase() === hostname &&
    result.action === CONTACT_ACTION_NAME;
}

function failed(error: string, values: ContactFormValues): ContactActionData {
  return { ok: false, error, values, attemptId: crypto.randomUUID() };
}

async function sendResendEmail(
  apiKey: string,
  email: {
    from: string;
    to: string[];
    reply_to: string;
    subject: string;
    text: string;
  },
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Resend rejected the message.");
}

export async function submitContact(
  form: FormData,
  request: Request,
  env: ContactEnvironment,
): Promise<ContactActionData> {
  const honeypot = readSingleString(form, "company_website");
  if (honeypot && honeypot.trim()) return { ok: true };

  const values = getFormValues(form);
  if (!values) return failed("フォームを読み取れませんでした。", EMPTY_CONTACT_VALUES);

  const validationError = validateValues(values, form);
  if (validationError) return failed(validationError, values);
  if (!isContactConfigured(env)) {
    return failed("現在、お問い合わせフォームは準備中です。", values);
  }

  const ip = getClientIp(request);
  if (!ip || !env.CONTACT_RATE_LIMITER || !env.CONTACT_TURNSTILE_SECRET) {
    return failed("現在、送信を受け付けられません。時間をおいて再度お試しください。", values);
  }

  const key = await hashRateLimitIp(env.CONTACT_TURNSTILE_SECRET, ip);
  const limit = await env.CONTACT_RATE_LIMITER.limit({ key });
  if (!limit.success) {
    return failed("送信回数が多いため、少し時間をおいてください。", values);
  }

  const turnstileToken = readSingleString(form, "turnstileToken") ?? "";
  try {
    const verified = await verifyTurnstile(
      turnstileToken,
      env.CONTACT_TURNSTILE_SECRET,
      request,
    );
    if (!verified) {
      return failed("本人確認を完了できませんでした。ページを更新して再度お試しください。", values);
    }
  } catch {
    return failed("本人確認サービスに接続できませんでした。時間をおいて再度お試しください。", values);
  }

  const topicLabel = TOPICS.get(values.topic);
  const { RESEND_API_KEY, CONTACT_TO, CONTACT_FROM } = env;
  if (!topicLabel || !RESEND_API_KEY || !CONTACT_TO || !CONTACT_FROM) {
    return failed("送信先の設定を確認できませんでした。", values);
  }

  const message = [
    "roseu.net のお問い合わせフォームから受信しました。",
    "",
    `種類: ${topicLabel}`,
    `お名前: ${values.name || "未入力"}`,
    `返信先: ${values.email}`,
    "",
    "お問い合わせ内容:",
    values.message,
  ].join("\n");

  const confirmationMessage = [
    "roseu.net のお問い合わせを受け付けました。",
    "以下の内容で送信されています。",
    "",
    `種類: ${topicLabel}`,
    `お名前: ${values.name || "未入力"}`,
    `返信先メールアドレス: ${values.email}`,
    "",
    "お問い合わせ内容:",
    values.message,
    "",
    "このメールに返信すると、Roseuへのお問い合わせとして届きます。",
  ].join("\n");

  try {
    await sendResendEmail(RESEND_API_KEY, {
      from: CONTACT_FROM,
      to: [CONTACT_TO],
      reply_to: values.email,
      subject: `[roseu.net] ${topicLabel}`,
      text: message,
    });
  } catch {
    // Do not log contact content or addresses.
    console.error("Resend contact email delivery failed.");
    return failed("送信できませんでした。時間をおいて再度お試しください。", values);
  }

  try {
    await sendResendEmail(RESEND_API_KEY, {
      from: CONTACT_FROM,
      to: [values.email],
      reply_to: CONTACT_TO,
      subject: "[roseu.net] お問い合わせを受け付けました",
      text: confirmationMessage,
    });
  } catch {
    // The inquiry was already accepted; do not make the user resend it.
    console.error("Resend contact confirmation email delivery failed.");
  }

  return { ok: true };
}
