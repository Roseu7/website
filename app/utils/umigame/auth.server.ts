import { createCookieSessionStorage, redirect } from "react-router";
import type { AppLoadContext, Session } from "react-router";
import { getAccessIdentity } from "~/utils/access.server";
import { safeReturnTo } from "~/utils/return-to";
import { clearAnonymousActorCookie, getAnonymousActorId } from "./anon.server";
import { getUmigameEnv, requireUmigameDb, type UmigameEnv } from "./env.server";
import {
  claimAnonymousPlaySessions,
  getUmigameUser,
  isExistingUmigameUserId,
  upsertAccessUser,
  type UmigameUser,
} from "./user.server";

interface AuthSessionData {
  userId?: string;
}

type AuthSession = Session<AuthSessionData, AuthSessionData>;
const storageCache = new Map<
  string,
  ReturnType<typeof createCookieSessionStorage<AuthSessionData>>
>();

function requireMainSiteHost(request: Request) {
  const hostname = new URL(request.url).hostname;
  if (!["roseu.net", "www.roseu.net", "localhost", "127.0.0.1"].includes(hostname)) {
    throw new Response("Not Found", { status: 404 });
  }
}
export function isAccessAuthConfigured(env: UmigameEnv) {
  return Boolean(
    env.UMIGAME_SESSION_SECRET &&
    env.CF_ACCESS_TEAM_DOMAIN &&
    env.UMIGAME_ACCESS_AUD
  );
}

function normalizeAccessTeamDomain(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function requireAuthEnv(env: UmigameEnv, key: keyof UmigameEnv) {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Response("Authentication is not configured.", { status: 503 });
  }
  return value;
}

function getStorage(secret: string) {
  const cached = storageCache.get(secret);
  if (cached) return cached;

  const storage = createCookieSessionStorage<AuthSessionData>({
    cookie: {
      name: "__Host-umigame_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      secrets: [secret],
    },
  });
  storageCache.set(secret, storage);
  return storage;
}

async function getAuthSession(
  request: Request,
  context: AppLoadContext,
): Promise<AuthSession> {
  const env = getUmigameEnv(context);
  const secret = requireAuthEnv(env, "UMIGAME_SESSION_SECRET");
  return getStorage(secret).getSession(request.headers.get("Cookie"));
}

async function commitAuthSession(
  session: AuthSession,
  context: AppLoadContext,
) {
  const env = getUmigameEnv(context);
  const secret = requireAuthEnv(env, "UMIGAME_SESSION_SECRET");
  return getStorage(secret).commitSession(session);
}

async function destroyAuthSession(
  session: AuthSession,
  context: AppLoadContext,
) {
  const env = getUmigameEnv(context);
  const secret = requireAuthEnv(env, "UMIGAME_SESSION_SECRET");
  return getStorage(secret).destroySession(session);
}
export async function getOptionalUmigameUser(
  request: Request,
  context: AppLoadContext,
): Promise<UmigameUser | null> {
  const env = getUmigameEnv(context);
  if (!env.UMIGAME_SESSION_SECRET) return null;

  const session = await getAuthSession(request, context);
  const userId = session.get("userId");
  if (!userId) return null;

  return getUmigameUser(requireUmigameDb(env), userId);
}

export async function requireUmigameUser(
  request: Request,
  context: AppLoadContext,
) {
  const user = await getOptionalUmigameUser(request, context);
  if (user) return user;

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.pathname + url.search);
  throw redirect("/auth/access/start?returnTo=" + encodeURIComponent(returnTo));
}

export async function startAccessLogin(
  request: Request,
  context: AppLoadContext,
) {
  requireMainSiteHost(request);

  const env = getUmigameEnv(context);
  if (!isAccessAuthConfigured(env)) {
    throw new Response("Authentication is not configured.", { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
  const callbackUrl = new URL("/auth/access/login", requestUrl.origin);
  callbackUrl.searchParams.set("returnTo", returnTo);

  const teamDomain = normalizeAccessTeamDomain(
    requireAuthEnv(env, "CF_ACCESS_TEAM_DOMAIN"),
  );
  const audience = requireAuthEnv(env, "UMIGAME_ACCESS_AUD");
  const loginUrl = new URL(
    `/cdn-cgi/access/login/${callbackUrl.hostname}`,
    teamDomain,
  );
  loginUrl.searchParams.set("kid", audience);
  loginUrl.searchParams.set(
    "redirect_url",
    callbackUrl.pathname + callbackUrl.search,
  );

  return redirect(loginUrl.toString(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function finishAccessLogin(
  request: Request,
  context: AppLoadContext,
) {
  requireMainSiteHost(request);

  const env = getUmigameEnv(context);
  if (!isAccessAuthConfigured(env)) {
    throw new Response("Authentication is not configured.", { status: 503 });
  }

  const audience = requireAuthEnv(env, "UMIGAME_ACCESS_AUD");
  const identity = await getAccessIdentity(request, context, audience);
  if (!identity) {
    throw new Response("Access identity is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const db = requireUmigameDb(env);
  const user = await upsertAccessUser(db, {
    email: identity.email,
    displayName: identity.name,
  });
  const anonymousActorId = getAnonymousActorId(request);
  if (
    anonymousActorId &&
    anonymousActorId !== user.id &&
    !(await isExistingUmigameUserId(db, anonymousActorId))
  ) {
    await claimAnonymousPlaySessions(db, anonymousActorId, user.id);
  }

  const session = await getAuthSession(request, context);
  session.set("userId", user.id);

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", await commitAuthSession(session, context));
  if (anonymousActorId) {
    headers.append("Set-Cookie", clearAnonymousActorCookie(request));
  }

  return redirect(returnTo === "/" ? "/games/umigame" : returnTo, { headers });
}

export async function logoutUmigame(
  request: Request,
  context: AppLoadContext,
) {
  requireMainSiteHost(request);
  const session = await getAuthSession(request, context);
  return redirect("/auth/access/logout?complete=1", {
    headers: {
      "Set-Cookie": await destroyAuthSession(session, context),
      "Cache-Control": "no-store",
    },
  });
}
