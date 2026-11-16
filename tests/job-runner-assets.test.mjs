import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { hydrateJobRunnerAssets } from "../server/workflows/job-runner-assets.mjs";

const required = ["run-discovery.mjs", "validate-discovery.mjs", "run-comparison.mjs", "validate-comparison.mjs"];

test("workflow hydrates all embedded runner modules into its isolated workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-runner-assets-"));
  try {
    const assets = new Map(required.map((key) => [key, `export const entry = ${JSON.stringify(key)};\n`]));
    assets.set("shared/chunk.mjs", "export const shared = true;\n");
    const storage = { async getKeys() { return [...assets.keys()]; }, async getItem(key) { return assets.get(key) ?? null; } };
    await hydrateJobRunnerAssets(storage, root);
    assert.equal(await readFile(join(root, "build", "job-runners", "shared", "chunk.mjs"), "utf8"), "export const shared = true;\n");
    for (const runner of required) assert.equal(await readFile(join(root, "build", "job-runners", runner), "utf8"), `export const entry = ${JSON.stringify(runner)};\n`);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("workflow runner hydration fails closed on missing entrypoints and traversal keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-runner-assets-"));
  try {
    const missing = { async getKeys() { return []; }, async getItem() { return null; } };
    await assert.rejects(hydrateJobRunnerAssets(missing, root), /Bundled job runner is unavailable/);
    const traversalAssets = new Map([...required.map((key) => [key, "ok"]), ["../escape", "bad"]]);
    const traversal = { async getKeys() { return [...traversalAssets.keys()]; }, async getItem(key) { return traversalAssets.get(key); } };
    await hydrateJobRunnerAssets(traversal, root);
    await assert.rejects(readFile(join(root, "escape"), "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});
