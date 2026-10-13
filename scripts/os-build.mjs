import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!["build", "deploy"].includes(command)) throw new Error("Expected build or deploy");
if (!args.includes("--prebuilt") && !args.includes("--help") && !args.includes("-h")) {
  const file = new URL("../os-build.json", import.meta.url);
  const { build } = JSON.parse(readFileSync(file, "utf8"));
  if (!Number.isSafeInteger(build) || build < 1000 || !Number.isSafeInteger(build + 1)) throw new Error("Invalid OS build number");
  writeFileSync(file, JSON.stringify({ build: build + 1 }, null, 2) + "\n");
}
const cli = fileURLToPath(new URL("../node_modules/cf/bin/cf", import.meta.url));
const result = spawnSync(process.execPath, [cli, command, ...args], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
