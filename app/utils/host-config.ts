export const MAIN_SITE_HOSTS = new Set([
  "roseu.net",
  "www.roseu.net",
  "localhost",
  "127.0.0.1",
  "mc.localhost",
]);

export const HOME_CONTROL_HOST = "home.roseu.net";
export const MC_DASHBOARD_HOST = "mc.roseu.net";

const LOCAL_MC_DASHBOARD_HOSTS = new Set(["mc.localhost"]);

export function isMcDashboardHost(hostname: string) {
  return hostname === MC_DASHBOARD_HOST || LOCAL_MC_DASHBOARD_HOSTS.has(hostname);
}

export function isCanonicalMcDashboardHost(hostname: string) {
  return hostname === MC_DASHBOARD_HOST;
}
