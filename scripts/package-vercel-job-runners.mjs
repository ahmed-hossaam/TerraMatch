import { access, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_RUNNERS = [
  "run-discovery.mjs",
  "validate-discovery.mjs",
  "run-comparison.mjs",
  "validate-comparison.mjs",
];

export async function packageVercelJobRunners(sourceDirectory, functionDirectory) {
  const source = resolve(sourceDirectory);
  const target = resolve(functionDirectory, "build/job-runners");
  for (const runner of REQUIRED_RUNNERS) await access(resolve(source, runner));
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true, force: true });
  return { source, target, runnerCount: REQUIRED_RUNNERS.length };
}

async function main() {
  const repositoryRoot = process.cwd();
  const source = resolve(repositoryRoot, "build/job-runners");
  const functionDirectory = resolve(repositoryRoot, ".vercel/output/functions/__server.func");
  const result = await packageVercelJobRunners(source, functionDirectory);
  console.log(`Packaged ${result.runnerCount} durable job runners into the Vercel function output.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
