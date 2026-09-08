import type { ActionFunctionArgs } from "react-router";

interface ServerStatusBody {
  serverId?: unknown;
  online?: unknown;
  playerCount?: unknown;
  maxPlayers?: unknown;
  players?: unknown;
  checkedAt?: unknown;
}

export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const [{ getMcDashboardEnv, requireMcServiceApiMasterSecret }, { verifySignedServiceJson }, { updateServerState }] =
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
  const body = await verifySignedServiceJson<ServerStatusBody>(request, secret);

  if (
    typeof body.online !== "boolean" ||
    typeof body.playerCount !== "number" ||
    typeof body.maxPlayers !== "number" ||
    !Array.isArray(body.players)
  ) {
    throw new Response("Invalid server status payload.", { status: 400 });
  }

  const players = body.players.flatMap((player) => {
    if (
      typeof player === "object" &&
      player !== null &&
      typeof (player as { uuid?: unknown }).uuid === "string" &&
      typeof (player as { name?: unknown }).name === "string"
    ) {
      return [{
        uuid: (player as { uuid: string }).uuid,
        name: (player as { name: string }).name,
      }];
    }
    return [];
  });

  await updateServerState(env.DB, {
    serverId: typeof body.serverId === "string" && body.serverId.length > 0 ? body.serverId : "main",
    online: body.online,
    playerCount: body.playerCount,
    maxPlayers: body.maxPlayers,
    players,
    checkedAt: typeof body.checkedAt === "string" ? body.checkedAt : new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
