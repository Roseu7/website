import type { ActionFunctionArgs } from "react-router";

interface RegisterLinkCodeBody {
  code?: unknown;
  minecraftUuid?: unknown;
  minecraftName?: unknown;
  expiresAt?: unknown;
}

export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [{ getMcDashboardEnv, requireMcServiceApiMasterSecret }, { verifySignedServiceJson }, { registerLinkCode }] =
    await Promise.all([
      import("~/utils/mc/env.server"),
      import("~/utils/mc/service-auth.server"),
      import("~/utils/mc/db.server"),
    ]);

  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", { status: 405 });
  }

  const env = getMcDashboardEnv(context);
  const secret = requireMcServiceApiMasterSecret(env);
  const body = await verifySignedServiceJson<RegisterLinkCodeBody>(request, secret, { db: env.DB, scope: "mc" });

  if (
    typeof body.code !== "string" ||
    typeof body.minecraftUuid !== "string" ||
    typeof body.minecraftName !== "string" ||
    typeof body.expiresAt !== "string"
  ) {
    throw new Response("Invalid link code payload.", { status: 400 });
  }

  await registerLinkCode(env.DB, {
    code: body.code,
    minecraftUuid: body.minecraftUuid,
    minecraftName: body.minecraftName,
    expiresAt: body.expiresAt,
  });

  return Response.json({ ok: true });
}
