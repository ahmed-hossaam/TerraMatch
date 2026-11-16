import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { packageVercelJobRunners } from "../scripts/package-vercel-job-runners.mjs";

test("Vercel function output receives the generated durable job runners and chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-job-runners-"));
  try {
    const source = join(root, "build", "job-runners");
    const functionDirectory = join(root, ".vercel", "output", "functions", "__server.func");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "run-discovery.mjs"), "import './chunk.mjs';\n");
    await writeFile(join(source, "validate-discovery.mjs"), "export {};\n");
    await writeFile(join(source, "run-comparison.mjs"), "export {};\n");
    await writeFile(join(source, "validate-comparison.mjs"), "export {};\n");
    await writeFile(join(source, "chunk.mjs"), "export const marker = true;\n");

    const result = await packageVercelJobRunners(source, functionDirectory);
    const target = join(functionDirectory, "build", "job-runners");
    assert.equal(result.runnerCount, 4);
    assert.equal(await readFile(join(target, "run-discovery.mjs"), "utf8"), "import './chunk.mjs';\n");
    assert.equal(await readFile(join(target, "chunk.mjs"), "utf8"), "export const marker = true;\n");
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("Vercel runner packaging fails if a required entrypoint is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-job-runners-"));
  try {
    const source = join(root, "source");
    await mkdir(source, { recursive: true });
    await assert.rejects(packageVercelJobRunners(source, join(root, "function")));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});
