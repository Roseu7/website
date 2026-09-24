import { createCookieSessionStorage } from "react-router";
import type { AppLoadContext, Session } from "react-router";
import { getMcDashboardEnv, requireMcEnvValue } from "~/utils/mc/env.server";

interface McSessionData {
  discordUserId?: string;
  discordOauthState?: string;
  discordReturnTo?: string;
}

type McSession = Session<McSessionData, McSessionData>;

const sessionStorageCache = new Map<string, ReturnType<typeof createCookieSessionStorage<McSessionData>>>();

function getSessionStorage(secret: string) {
  const cached = sessionStorageCache.get(secret);
  if (cached) {
    return cached;
  }

  const storage = createCookieSessionStorage<McSessionData>({
    cookie: {
      name: "__Host-survcore_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      secrets: [secret],
    },
  });

  sessionStorageCache.set(secret, storage);
  return storage;
}

function resolveStorage(context: AppLoadContext) {
  const env = getMcDashboardEnv(context);
  const secret = requireMcEnvValue(env, "SURVCORE_SESSION_SECRET");
  return getSessionStorage(secret);
}

export async function getMcSession(request: Request, context: AppLoadContext): Promise<McSession> {
  const storage = resolveStorage(context);
  return storage.getSession(request.headers.get("Cookie"));
}

export async function commitMcSession(session: McSession, context: AppLoadContext) {
  const storage = resolveStorage(context);
  return storage.commitSession(session);
}

export async function destroyMcSession(session: McSession, context: AppLoadContext) {
  const storage = resolveStorage(context);
  return storage.destroySession(session);
}
