import type { AppLoadContext } from "react-router";

export interface McDashboardEnv {
  DB: D1Database;
  SURVCORE_DISCORD_CLIENT_ID?: string;
  SURVCORE_DISCORD_CLIENT_SECRET?: string;
  SURVCORE_DISCORD_REDIRECT_URI?: string;
  SURVCORE_SESSION_SECRET?: string;
  MC_SERVICE_API_MASTER_SECRET?: string;
  NIKOSERVER_DISCORD_GUILD_ID?: string;
  SURVCORE_DISCORD_BOT_TOKEN?: string;
  SURVCORE_DISCORD_PUBLIC_KEY?: string;
  SURVCORE_OWNER_DISCORD_ID?: string;
  SURVCORE_MAP_ORIGIN_URL?: string;
  SURVCORE_MAP_ORIGIN_ACCESS_CLIENT_ID?: string;
  SURVCORE_MAP_ORIGIN_ACCESS_CLIENT_SECRET?: string;
}

export function getMcDashboardEnv(context: AppLoadContext): McDashboardEnv {
  return (context.cloudflare?.env ?? {}) as McDashboardEnv;
}

export function requireMcEnvValue(
  env: McDashboardEnv,
  key: keyof McDashboardEnv
): string {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Response(`Missing env: ${String(key)}`, { status: 500 });
  }
  return value;
}

export function requireMcServiceApiMasterSecret(env: McDashboardEnv) {
  return requireMcEnvValue(env, "MC_SERVICE_API_MASTER_SECRET");
}

export function requireNikoServerDiscordGuildId(env: McDashboardEnv) {
  return requireMcEnvValue(env, "NIKOSERVER_DISCORD_GUILD_ID");
}

export function requireOwnerDiscordUser(
  env: McDashboardEnv,
  discordUserId: string
) {
  const ownerDiscordId = requireMcEnvValue(env, "SURVCORE_OWNER_DISCORD_ID");
  if (discordUserId !== ownerDiscordId) {
    throw new Response("Forbidden", { status: 403 });
  }
}
