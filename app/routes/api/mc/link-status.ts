import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

interface LinkStatusBody {
  minecraftUuid?: unknown;
}

export async function loader(_: LoaderFunctionArgs) {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [{ getMcDashboardEnv, requireMcServiceApiMasterSecret }, { verifySignedServiceJson }, { getActiveLinkByMinecraftUuid }] =
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
  const body = await verifySignedServiceJson<LinkStatusBody>(request, secret);

  if (typeof body.minecraftUuid !== "string" || body.minecraftUuid.length == 0) {
    throw new Response("Invalid link status payload.", { status: 400 });
  }

  const link = await getActiveLinkByMinecraftUuid(env.DB, body.minecraftUuid);
  return Response.json({
    linked: link !== null,
    link,
  });
}
