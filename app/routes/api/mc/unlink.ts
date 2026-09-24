import type { ActionFunctionArgs } from "react-router";

interface UnlinkBody {
  minecraftUuid?: unknown;
}

export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [{ getMcDashboardEnv, requireMcServiceApiMasterSecret }, { verifySignedServiceJson }, { unlinkMinecraftAccountByUuid }] =
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
  const body = await verifySignedServiceJson<UnlinkBody>(request, secret, { db: env.DB, scope: "mc" });

  if (typeof body.minecraftUuid !== "string" || body.minecraftUuid.length === 0) {
    throw new Response("Invalid unlink payload.", { status: 400 });
  }

  const unlinked = await unlinkMinecraftAccountByUuid(env.DB, body.minecraftUuid);
  return Response.json({ ok: true, unlinked });
}
