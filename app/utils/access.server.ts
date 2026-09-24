import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppLoadContext } from "react-router";

interface AccessEnv {
  CF_ACCESS_TEAM_DOMAIN?: string;
}

export interface AccessIdentity {
  email: string;
  name: string | null;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getCookie(request: Request, name: string) {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=") || null;
  }

  return null;
}

function normalizeTeamDomain(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getJwks(teamDomain: string) {
  const cached = jwksCache.get(teamDomain);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`),
  );
  jwksCache.set(teamDomain, jwks);
  return jwks;
}
export async function getAccessIdentity(
  request: Request,
  context: AppLoadContext,
  expectedAudience: string,
): Promise<AccessIdentity | null> {
  const env = (context.cloudflare?.env ?? {}) as AccessEnv;
  const rawTeamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  if (!rawTeamDomain || !expectedAudience) return null;

  const headerToken = request.headers.get("Cf-Access-Jwt-Assertion");
  const cookieToken = getCookie(request, "CF_Authorization");
  const token = headerToken ?? cookieToken;

  if (!token) {
    console.error("Access JWT missing.", {
      hasAssertionHeader: Boolean(headerToken),
      hasAuthorizationCookie: Boolean(cookieToken),
    });
    return null;
  }

  const teamDomain = normalizeTeamDomain(rawTeamDomain);

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience: expectedAudience,
    });

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (!email) return null;
    return {
      email,
      name: null,
    };
  } catch (error) {
    console.error("Access JWT validation failed.", error);
    return null;
  }
}
