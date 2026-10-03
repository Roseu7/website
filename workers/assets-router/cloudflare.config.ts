import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "assets-router",
    entrypoint: "../assets.ts",
    compatibilityDate: "2025-04-04",
    observability: { enabled: true },
    domains: ["assets.roseu.net"],
    env: {
      ASSETS_BUCKET: bindings.r2({ name: "assets" }),
      WEBGAME_BUCKET: bindings.r2({ name: "webgame" }),
      RG_BUCKET: bindings.r2({ name: "rg-assets" }),
    },
  },
});
