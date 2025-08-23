import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // 404 catch-all route (must be last)
    route("*", "routes/$.tsx"),
] satisfies RouteConfig;
