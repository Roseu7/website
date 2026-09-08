export type PcPowerState = "on" | "off" | "unknown";

export interface PcStatePayload {
  power: PcPowerState;
  canWake: boolean;
  canShutdown: boolean;
  source: "home-agent" | "derived" | "none";
  checkedAt: string;
  hostname?: string;
  uptimeSec?: number;
  message?: string;
}

export interface HomeControlActionResult {
  ok: boolean;
  message?: string;
}
