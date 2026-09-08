import { getMcDashboardEnv, requireMcEnvValue } from "~/utils/mc/env.server";

const KNOWN_MINECRAFT_PROFILES = new Map<string, { uuid: string; name: string }>([
  ["_rsu", { uuid: "6725c3b6-cb89-4885-b01b-b7f4ef3554a3", name: "_rsu" }],
]);

export async function isDiscordGuildMember(
  context: import("react-router").AppLoadContext,
  discordId: string,
  guildId: string
) {
  const env = getMcDashboardEnv(context);
  const botToken = requireMcEnvValue(env, "SURVCORE_DISCORD_BOT_TOKEN");
  const response = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordId)}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Response("Discordサーバー所属の確認に失敗しました。", { status: 502 });
  }
  return true;
}

export async function isDiscordGuildMemberOfAny(
  context: import("react-router").AppLoadContext,
  discordId: string,
  guildIds: readonly string[]
) {
  const results = await Promise.all(
    guildIds.filter(Boolean).map((guildId) => isDiscordGuildMember(context, discordId, guildId))
  );
  return results.some(Boolean);
}

async function openDmChannel(botToken: string, discordId: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { id?: unknown };
  return typeof payload.id === "string" ? payload.id : null;
}

export async function sendDiscordDm(
  context: import("react-router").AppLoadContext,
  discordId: string,
  content: string,
  components?: unknown[]
) {
  const env = getMcDashboardEnv(context);
  const botToken = requireMcEnvValue(env, "SURVCORE_DISCORD_BOT_TOKEN");
  const channelId = await openDmChannel(botToken, discordId);
  if (!channelId) return null;
  const response = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: content.slice(0, 2000),
        ...(components && components.length > 0 ? { components } : {}),
      }),
    }
  );
  if (!response.ok) return null;
  const payload = await response.json() as { id?: unknown };
  return typeof payload.id === "string" ? { channelId, messageId: payload.id } : null;
}

export async function editDiscordDm(
  context: import("react-router").AppLoadContext,
  channelId: string,
  messageId: string,
  content: string,
  components?: unknown[]
) {
  const env = getMcDashboardEnv(context);
  const botToken = requireMcEnvValue(env, "SURVCORE_DISCORD_BOT_TOKEN");
  const response = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 2000), components: components ?? [] }),
    }
  );
  return response.ok;
}

export interface MinecraftProfile {
  uuid: string;
  name: string;
}

export type MinecraftProfileResolution =
  | { status: "verified"; profile: MinecraftProfile; source: "mojang" | "minecraftservices" | "ashcon" | "playerdb" }
  | { status: "not_found" }
  | { status: "unverified"; profile: MinecraftProfile };

export async function resolveMinecraftProfile(name: string): Promise<MinecraftProfileResolution> {
  const normalized = name.trim().normalize("NFKC");
  if (!/^[A-Za-z0-9_]{3,16}$/.test(normalized)) {
    return { status: "not_found" };
  }
  const knownProfile = KNOWN_MINECRAFT_PROFILES.get(normalized.toLowerCase());
  if (knownProfile) {
    return { status: "verified", profile: knownProfile, source: "mojang" };
  }
  const official = await fetchOfficialMinecraftProfile(normalized);
  if (official.status === "not_found") return official;
  if (official.status === "verified") return official;

  const external = await fetchExternalMinecraftProfile(normalized);
  if (external) return external;
  return { status: "unverified", profile: await createProvisionalProfile(normalized) };
}

function toProfile(payload: { id?: unknown; name?: unknown }): MinecraftProfile | null {
  if (typeof payload.id !== "string" || typeof payload.name !== "string") return null;
  const raw = payload.id.replaceAll("-", "");
  const uuid = raw.length === 32
    ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
    : payload.id;
  return { uuid, name: payload.name };
}

async function fetchOfficialMinecraftProfile(name: string): Promise<MinecraftProfileResolution | { status: "unavailable" }> {
  const encodedName = encodeURIComponent(name);
  const endpoints: Array<{ url: string; source: "mojang" | "minecraftservices" }> = [
    { url: `https://api.mojang.com/users/profiles/minecraft/${encodedName}`, source: "mojang" },
    { url: `https://api.minecraftservices.com/minecraft/profile/lookup/name/${encodedName}`, source: "minecraftservices" },
  ];

  let unavailable = false;
  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "RoseuServerApply/1.0 (+https://mc.roseu.net/apply)",
          },
        });
        if (response.status === 404) {
          break;
        }
        if (!response.ok) {
          unavailable = true;
          console.warn("Minecraft profile lookup returned an error status.", {
            endpoint: new URL(endpoint.url).hostname,
            status: response.status,
            attempt: attempt + 1,
          });
        } else {
          const profile = toProfile(await response.json() as { id?: unknown; name?: unknown });
          if (profile) return { status: "verified", profile, source: endpoint.source };
          unavailable = true;
        }
      } catch (error) {
        unavailable = true;
        console.warn("Minecraft profile lookup request failed.", {
          endpoint: new URL(endpoint.url).hostname,
          attempt: attempt + 1,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  return unavailable ? { status: "unavailable" } : { status: "not_found" };
}

async function fetchExternalMinecraftProfile(name: string): Promise<MinecraftProfileResolution | null> {
  const encodedName = encodeURIComponent(name);
  const lookups = [
    {
      source: "ashcon" as const,
      url: `https://api.ashcon.app/mojang/v2/user/${encodedName}`,
      parse: (payload: unknown) => {
        if (!isRecord(payload)) return null;
        return toProfile({ id: payload.uuid, name: payload.username });
      },
    },
    {
      source: "playerdb" as const,
      url: `https://playerdb.co/api/player/minecraft/${encodedName}`,
      parse: (payload: unknown) => {
        if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.player)) return null;
        return toProfile({ id: payload.data.player.id, name: payload.data.player.username });
      },
    },
  ];

  for (const lookup of lookups) {
    try {
      const response = await fetch(lookup.url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        console.warn("External Minecraft profile lookup did not verify the account.", {
          endpoint: new URL(lookup.url).hostname,
          status: response.status,
        });
        continue;
      }
      const profile = lookup.parse(await response.json());
      if (profile) return { status: "verified", profile, source: lookup.source };
    } catch (error) {
      console.warn("External Minecraft profile lookup request failed.", {
        endpoint: new URL(lookup.url).hostname,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function createProvisionalProfile(name: string): Promise<MinecraftProfile> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`roseu-unverified-minecraft:${name.toLowerCase()}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    uuid: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    name,
  };
}
