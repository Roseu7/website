import { getMcDashboardEnv, requireMcEnvValue } from "~/utils/mc/env.server";

export interface DiscordOAuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export function createDiscordLoginUrl(context: import("react-router").AppLoadContext, state: string) {
  const env = getMcDashboardEnv(context);
  const clientId = requireMcEnvValue(env, "SURVCORE_DISCORD_CLIENT_ID");
  const redirectUri = requireMcEnvValue(env, "SURVCORE_DISCORD_REDIRECT_URI");
  return buildAuthorizeUrl(clientId, redirectUri, state);
}

export async function exchangeDiscordCode(
  context: import("react-router").AppLoadContext,
  code: string
) {
  const env = getMcDashboardEnv(context);
  const clientId = requireMcEnvValue(env, "SURVCORE_DISCORD_CLIENT_ID");
  const clientSecret = requireMcEnvValue(env, "SURVCORE_DISCORD_CLIENT_SECRET");
  const redirectUri = requireMcEnvValue(env, "SURVCORE_DISCORD_REDIRECT_URI");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Response("Discord OAuth token exchange failed.", { status: 502 });
  }

  const data = await response.json() as { access_token?: unknown };
  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new Response("Discord OAuth token was missing.", { status: 502 });
  }

  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordOAuthUser> {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Response("Discord user profile fetch failed.", { status: 502 });
  }

  const data = await response.json() as Record<string, unknown>;
  if (typeof data.id !== "string" || typeof data.username !== "string") {
    throw new Response("Discord user payload was invalid.", { status: 502 });
  }

  return {
    id: data.id,
    username: data.username,
    global_name: typeof data.global_name === "string" ? data.global_name : null,
    avatar: typeof data.avatar === "string" ? data.avatar : null,
  };
}
