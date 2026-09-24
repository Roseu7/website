import type { AppLoadContext } from "react-router";

interface JevAccessEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

interface AccessJwtPayload {
  aud?: string | string[];
}

export interface JevAccessIdentity {
  userId: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function getEnv(context: AppLoadContext): JevAccessEnv {
  return (context.cloudflare?.env ?? {}) as JevAccessEnv;
}

function getCookie(request: Request, name: string) {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

function decodeJwtPayload(token: string): AccessJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

    return JSON.parse(atob(normalized)) as AccessJwtPayload;
  } catch {
    return null;
  }
}

function audienceMatches(payload: AccessJwtPayload | null, expectedAud: string) {
  if (!payload?.aud) return false;
  if (Array.isArray(payload.aud)) return payload.aud.includes(expectedAud);
  return payload.aud === expectedAud;
}

function normalizeTeamDomain(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function getJevAccessIdentity(
  request: Request,
  context: AppLoadContext
): Promise<JevAccessIdentity | null> {
  const url = new URL(request.url);

  if (LOCAL_HOSTS.has(url.hostname)) {
    return { userId: `local:${url.hostname}` };
  }

  const env = getEnv(context);
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();

  if (!teamDomain || !audience) {
    console.error("Jev Access is not configured.");
    return null;
  }

  const token = getCookie(request, "CF_Authorization");
  if (!token) return null;

  const bindingCookie = getCookie(request, "CF_Binding");
  const accessCookies = [
    `CF_Authorization=${token}`,
    bindingCookie ? `CF_Binding=${bindingCookie}` : null,
  ].filter(Boolean).join("; ");

  const payload = decodeJwtPayload(token);
  if (!audienceMatches(payload, audience)) {
    return null;
  }

  try {
    const response = await fetch(
      `${normalizeTeamDomain(teamDomain)}/cdn-cgi/access/get-identity`,
      {
        headers: {
          Cookie: accessCookies,
        },
      }
    );

    if (!response.ok) return null;
    const identity: unknown = await response.json();
    if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
      return null;
    }

    const userId = (identity as { user_uuid?: unknown }).user_uuid;
    return typeof userId === "string" && userId.length > 0 && userId.length <= 255
      ? { userId }
      : null;
  } catch (error) {
    console.error("Failed to validate Jev Access session.", error);
    return null;
  }
}

export async function isJevAuthenticated(
  request: Request,
  context: AppLoadContext,
) {
  return (await getJevAccessIdentity(request, context)) !== null;
}
