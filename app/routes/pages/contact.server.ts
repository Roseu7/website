
import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from "~/framework/http";

import { requireSameOriginRequest } from "~/utils/request-origin.server";

import { readLimitedFormData } from "~/utils/request-body.server";

import { CONTACT_BODY_LIMIT, EMPTY_CONTACT_VALUES, getContactEnvironment, isContactConfigured, submitContact, type ContactActionData } from "~/utils/contact.server";

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
