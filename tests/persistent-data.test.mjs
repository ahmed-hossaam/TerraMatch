import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, lstat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { preparePersistentData } from "../scripts/prepare-persistent-data.mjs";

test("persistent data overlay seeds mutable artifacts and keeps immutable inputs in place", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "terramatch-persist-"));
  const projectRoot = join(temporaryRoot, "project");
  const dataRoot = join(projectRoot, "data");
  const persistentRoot = join(temporaryRoot, "volume");
  const latest = join(dataRoot, "processed", "discovery-runs", "latest.json");
  const referenceSites = join(dataRoot, "processed", "reference-sites.json");

  try {
    await mkdir(join(dataRoot, "processed", "discovery-runs"), { recursive: true });
    await writeFile(latest, JSON.stringify({ runId: "existing-run" }));
    await writeFile(referenceSites, JSON.stringify([{ id: "GKC" }]));

    const result = await preparePersistentData({ projectRoot, persistentDataDir: persistentRoot });
    assert.equal(result.enabled, true);
    assert.ok(result.linkedDirectories.includes("processed/discovery-runs"));
    assert.deepEqual(JSON.parse(await readFile(latest, "utf8")), { runId: "existing-run" });
    assert.deepEqual(JSON.parse(await readFile(join(persistentRoot, "processed", "discovery-runs", "latest.json"), "utf8")), { runId: "existing-run" });
    assert.deepEqual(JSON.parse(await readFile(referenceSites, "utf8")), [{ id: "GKC" }]);
    assert.equal((await lstat(referenceSites)).isSymbolicLink(), false);

    await writeFile(latest, JSON.stringify({ runId: "new-run" }));
    await preparePersistentData({ projectRoot, persistentDataDir: persistentRoot });
    assert.deepEqual(JSON.parse(await readFile(join(persistentRoot, "processed", "discovery-runs", "latest.json"), "utf8")), { runId: "new-run" });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
