import type { UmigameEnv } from "./env.server";

export type DailyQuotaResult = "reserved" | "limited" | "unavailable";
export type DailyQuotaKind = "ai" | "sessions";

export interface DailyQuotaActor {
  actorId: string;
  user?: { id: string } | null;
}

export const UMIGAME_DAILY_QUOTAS = {
  anonymous: { ai: 600, sessions: 50 },
  authenticated: { ai: 3000, sessions: 200 },
  jevTool: 300,
} as const;

// Vercel publishes September 25, 2026 as the promo end date, but no time or
// timezone. This UTC cutoff keeps the promo day free worldwide, then enables
// daily caps. Wrangler config sets the same value for both Workers.
export const JEV_DAILY_QUOTA_DEFAULT_STARTS_AT = "2026-09-26T12:00:00.000Z";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETAIN_DAYS = 8;
const encoder = new TextEncoder();

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function normalizeIpAddress(value: string): string | null {
  const address = value.trim();
  if (!address || address.includes(",") || address.includes("%")) return null;

  const ipv4 = address.split(".");
  if (ipv4.length === 4 && ipv4.every((part) => /^\d{1,3}$/.test(part))) {
    const octets = ipv4.map(Number);
    if (octets.every((octet) => octet >= 0 && octet <= 255)) {
      return `ipv4:${octets.join(".")}`;
    }
  }

  try {
    const hostname = new URL(`http://[${address}]/`).hostname;
    if (!hostname.startsWith("[") || !hostname.endsWith("]")) return null;
    const normalized = hostname.slice(1, -1).toLowerCase();
    const halves = normalized.split("::");
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
      return null;
    }
    const groups = [
      ...left,
      ...Array(halves.length === 2 ? missing : 0).fill("0"),
      ...right,
    ].map((group) => group.padStart(4, "0"));
    if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{4}$/.test(group))) {
      return null;
    }

    if (groups.slice(0, 5).every((group) => group === "0000") && groups[5] === "ffff") {
      const high = Number.parseInt(groups[6], 16);
      const low = Number.parseInt(groups[7], 16);
      return `ipv4:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }

    return `ipv6:${groups.slice(0, 4).join(":")}/64`;
  } catch {
    return null;
  }
}

export function getClientIpPrefix(request: Request): string | null {
  const header = request.headers.get("CF-Connecting-IP");
  if (header) return normalizeIpAddress(header);

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return `local:${hostname}`;
  }
  return null;
}

export async function getPrincipalRateLimitKey(
  secret: string,
  scope: string,
  principal: string,
) {
  return hmac(secret, `rate-limit\0${scope}\0${principal}`);
}

export async function getClientRateLimitKey(
  request: Request,
  secret: string | undefined,
  action: string,
) {
  const prefix = getClientIpPrefix(request);
  if (!prefix || !secret) return null;
  return `umigame:${action}:ip:${await getPrincipalRateLimitKey(secret, action, prefix)}`;
}

function getQuotaDay(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export async function reserveDailyQuota(
  db: D1Database,
  secret: string,
  scope: string,
  principal: string,
  units: number,
  dailyLimit: number,
  now = Date.now(),
): Promise<DailyQuotaResult> {
  if (
    !secret || !scope || scope.length > 80 || !principal || principal.length > 512 ||
    !Number.isSafeInteger(units) || units < 1 ||
    !Number.isSafeInteger(dailyLimit) || dailyLimit < 1
  ) {
    return "unavailable";
  }
  if (units > dailyLimit) return "limited";

  const usageDay = getQuotaDay(now);
  const expiryDay = getQuotaDay(now - RETAIN_DAYS * DAY_MS);
  const principalHash = await hmac(secret, `quota\0${scope}\0${principal}`);

  try {
    await db.prepare("DELETE FROM umigame_daily_usage WHERE usage_day < ?")
      .bind(expiryDay)
      .run();

    const row = await db.prepare(`
      INSERT INTO umigame_daily_usage
        (usage_day, scope, principal_hash, used_units, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (usage_day, scope, principal_hash) DO UPDATE SET
        used_units = used_units + excluded.used_units,
        updated_at = excluded.updated_at
      WHERE used_units + excluded.used_units <= ?
      RETURNING used_units
    `).bind(
      usageDay,
      scope,
      principalHash,
      units,
      now,
      dailyLimit,
    ).first<{ used_units: number }>();

    return row ? "reserved" : "limited";
  } catch {
    return "unavailable";
  }
}

function getUmigameBindings(env: UmigameEnv) {
  return {
    db: env.DB ?? (env as UmigameEnv & { UMIGAME_DB?: D1Database }).UMIGAME_DB,
    secret: env.UMIGAME_SESSION_SECRET,
  };
}

function isDailyQuotaStarted(
  env: Pick<UmigameEnv, "JEV_DAILY_QUOTA_STARTS_AT">,
  now: number,
) {
  const startsAt = Date.parse(
    env.JEV_DAILY_QUOTA_STARTS_AT ?? JEV_DAILY_QUOTA_DEFAULT_STARTS_AT,
  );
  return !Number.isFinite(startsAt) || now >= startsAt;
}

export function isJevDailyQuotaActive(
  env: Pick<UmigameEnv, "JEV_DAILY_QUOTA_STARTS_AT" | "JEV_PROVIDER" | "JEV_FALLBACK_PROVIDER">,
  now = Date.now(),
) {
  // TypeSafe is a separate, paid provider path, so it keeps the daily cap.
  if (env.JEV_PROVIDER === "typesafe" || env.JEV_FALLBACK_PROVIDER === "typesafe") {
    return true;
  }
  return isDailyQuotaStarted(env, now);
}

export async function reserveUmigameDailyQuota(
  env: UmigameEnv,
  request: Request,
  actor: DailyQuotaActor,
  kind: DailyQuotaKind,
  units: number,
  now = Date.now(),
): Promise<DailyQuotaResult> {
  if (kind === "ai" && !isJevDailyQuotaActive(env, now)) return "reserved";

  const { db, secret } = getUmigameBindings(env);
  if (!db || !secret) return "unavailable";

  const authenticated = Boolean(actor.user?.id);
  const principal = authenticated ? actor.user!.id : getClientIpPrefix(request);
  if (!principal) return "unavailable";

  const tier = authenticated ? "authenticated" : "anonymous";
  const dailyLimit = UMIGAME_DAILY_QUOTAS[tier][kind];
  return reserveDailyQuota(
    db,
    secret,
    `umigame:${tier}:${kind}`,
    principal,
    units,
    dailyLimit,
    now,
  );
}

export async function reserveJevToolDailyQuota(
  env: UmigameEnv,
  accessUserId: string,
  units: number,
  now = Date.now(),
): Promise<DailyQuotaResult> {
  if (!isDailyQuotaStarted(env, now)) {
    return Number.isSafeInteger(units) && units > 0 ? "reserved" : "unavailable";
  }

  const { db, secret } = getUmigameBindings(env);
  if (!db || !secret || !accessUserId) return "unavailable";
  return reserveDailyQuota(
    db,
    secret,
    "jev:tool:user",
    accessUserId,
    units,
    UMIGAME_DAILY_QUOTAS.jevTool,
    now,
  );
}
