import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("projects", "routes/projects.tsx"),
    route("about", "routes/about.tsx"),
    route("tools", "routes/tools/index.tsx"),
    route("tools/wsolver", "routes/tools/wsolver.tsx"),
    route("home-control", "routes/home/control.tsx"),
    route("wsolver", "routes/redirects/wsolver.tsx"),
    route("api/next", "routes/api/next.ts"),
    route("api/home/status", "routes/home/api.status.ts"),
    route("api/home/wake", "routes/home/api.wake.ts"),
    route("api/home/shutdown", "routes/home/api.shutdown.ts"),
    // 404用ルート(最後に配置)
    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
