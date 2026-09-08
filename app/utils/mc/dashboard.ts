export interface DashboardPlayer {
  uuid: string;
  name: string;
}

export interface DashboardServerState {
  serverId: string;
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  players: DashboardPlayer[];
  checkedAt: string;
}

export interface DashboardDiscordUser {
  discordId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

export interface DashboardMinecraftLink {
  minecraftUuid: string;
  minecraftName: string;
  linkedAt: string;
}

export interface McDashboardLoaderData {
  isAuthenticated: boolean;
  discordUser: DashboardDiscordUser | null;
  minecraftLink: DashboardMinecraftLink | null;
  serverState: DashboardServerState | null;
  serverOnline: boolean;
  checkedAtLabel: string;
  loginUrl: string;
  notice: string | null;
}

const MC_DASHBOARD_TIME_ZONE = "Asia/Tokyo";

export function formatMcCheckedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: MC_DASHBOARD_TIME_ZONE,
  }).format(date);
}

export function isMcServerOnline(checkedAt: string | null, online: boolean) {
  if (!online || !checkedAt) {
    return false;
  }

  const checkedAtMs = new Date(checkedAt).getTime();
  if (!Number.isFinite(checkedAtMs)) {
    return false;
  }

  return Date.now() - checkedAtMs <= 90_000;
}
