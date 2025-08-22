import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("chat-test", "routes/chat-test.tsx"),
] satisfies RouteConfig;
