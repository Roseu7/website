import { cp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * React Router 7 reads client manifests from build/client, while the cf Vite
 * plugin writes Build Output to .cloudflare. Remove this bridge in Phase 2.
 */
export function reactRouter7BuildOutput(): Plugin {
  let root: string;
  let assetsDirectory: string;

  return {
    name: "roseu:react-router7-build-output",
    apply: "build",
    configResolved(config) {
      root = config.root;
      assetsDirectory = resolve(root, config.environments.client.build.outDir);
    },
    writeBundle: {
      order: "post",
      async handler() {
        const legacyClientDirectory = resolve(root, "build/client");
        if (assetsDirectory === legacyClientDirectory) return;
        if (this.environment.name === "client") {
          if (relative(root, legacyClientDirectory) !== join("build", "client")) {
            throw new Error("React Router build directory is outside the project.");
          }
          await rm(legacyClientDirectory, { recursive: true, force: true });
          await cp(assetsDirectory, legacyClientDirectory, { recursive: true });
        } else if (this.environment.name === "ssr") {
          // React Router can move server-only assets into its client directory.
          await cp(legacyClientDirectory, assetsDirectory, { recursive: true });
        }
      },
    },
  };
}
