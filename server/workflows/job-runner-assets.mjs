import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const REQUIRED_RUNNERS = [
  "run-discovery.mjs",
  "validate-discovery.mjs",
  "run-comparison.mjs",
  "validate-comparison.mjs",
];

export async function hydrateJobRunnerAssets(storage, workspace) {
  const keys = await storage.getKeys();
  const runnerKeys = keys.filter((key) => typeof key === "string" && key.length > 0 && key.split("/").every((part) => part !== "." && part !== ".."));
  for (const runner of REQUIRED_RUNNERS) {
    if (!runnerKeys.includes(runner)) throw new Error(`Bundled job runner is unavailable: ${runner}`);
  }

  for (const key of runnerKeys) {
    const contents = await storage.getItem(key);
    if (contents == null) throw new Error(`Bundled job runner asset is unavailable: ${key}`);
    const path = join(workspace, "build", "job-runners", ...key.split("/"));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
}
