import { readLimitedText } from "~/utils/request-body.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleSManageOperation } from "~/utils/smanage/handlers.server";
import { requireStrings, type ServiceBody } from "~/utils/smanage/payload.server";

export async function loader(_: LoaderFunctionArgs) {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [
    { getMcDashboardEnv, requireMcServiceApiMasterSecret, requireNikoServerDiscordGuildId },
    { deriveServerApiSecret, parseServiceJson, verifySignedServiceBody },
    inviteDb,
  ] = await Promise.all([
    import("~/utils/mc/env.server"),
    import("~/utils/mc/service-auth.server"),
    import("~/utils/invites/db.server"),
  ]);
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", { status: 405 });
  }
  const env = getMcDashboardEnv(context);
  const bodyText = await readLimitedText(request, 64 * 1024);
  const body = parseServiceJson<ServiceBody>(bodyText);
  requireStrings(body, ["serverId"]);
  const serverId = body.serverId as string;
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(serverId)) {
    throw new Response("Invalid server ID.", { status: 400 });
  }
  const masterSecret = requireMcServiceApiMasterSecret(env);
  await verifySignedServiceBody(request, bodyText, await deriveServerApiSecret(masterSecret, serverId), { db: env.DB, scope: `smanage:${serverId}` });
  await inviteDb.ensureDefaultManagedServer(
    env.DB,
    requireNikoServerDiscordGuildId(env)
  );
  if (!await inviteDb.getManagedServer(env.DB, serverId)) {
    throw new Response("Unknown server.", { status: 403 });
  }

  return handleSManageOperation({ body, context, env, inviteDb, serverId });
}
