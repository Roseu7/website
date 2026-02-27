import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("wsolver", "routes/wsolver.tsx"),
    route("api/next", "routes/api.next.ts"),
    // 404用ルート(最後に配置)
    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
