import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home/index.tsx"),
    route("projects", "routes/pages/projects.tsx"),
    route("about", "routes/pages/about.tsx"),
    route("tools", "routes/pages/tools/index.tsx"),
    route("tools/wsolver", "routes/pages/tools/wsolver.tsx"),
    route("home-control", "routes/home/control.tsx"),
    route("auth/discord/start", "routes/auth/discord/start.ts"),
    route("auth/discord/callback", "routes/auth/discord/callback.ts"),
    route("auth/logout", "routes/auth/logout.ts"),
    route("map", "routes/map/index.ts"),
    route("map/*", "routes/map/$.ts"),
    route("apply", "routes/apply.tsx"),
    route("wsolver", "routes/redirects/wsolver.tsx"),
    route("api/next", "routes/api/next.ts"),
    route("api/home/status", "routes/home/api/status.ts"),
    route("api/home/wake", "routes/home/api/wake.ts"),
    route("api/home/shutdown", "routes/home/api/shutdown.ts"),
    route("api/mc/link-codes", "routes/api/mc/link-codes.ts"),
    route("api/mc/link-status", "routes/api/mc/link-status.ts"),
    route("api/mc/status", "routes/api/mc/status.ts"),
    route("api/mc/unlink", "routes/api/mc/unlink.ts"),
    route("api/smanage", "routes/api/smanage.ts"),
    route("api/discord/interactions", "routes/api/discord/interactions.ts"),
    // 404用ルート(最後に配置)
    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
