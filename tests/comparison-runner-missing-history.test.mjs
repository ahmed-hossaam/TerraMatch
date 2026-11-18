import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("comparison runner records unavailable climate factors when optional reference history is absent", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-comparison-no-reference-history-"));
  try {
    const data = join(root, "data");
    const inputs = [
      "processed/reference-sites.json",
      "curation/reference-curation-v1.json",
    ];
    for (const relative of inputs) {
      const target = join(data, relative);
      await mkdir(dirname(target), { recursive: true });
      await cp(join(projectRoot, "data", relative), target);
    }
    // Intentionally do not create processed/climate/known-sites-daily.json.
    const discoveryPath = join(data, "processed/discovery-runs/fixture-run.json");
    await mkdir(dirname(discoveryPath), { recursive: true });
    await writeFile(discoveryPath, JSON.stringify({
      schemaVersion: "1.0.0",
      runId: "fixture-run-12345678",
      missionProfileId: "mars-surface-analog-requirements",
      missionProfileVersion: "1.0.0",
      missionId: "extreme_environment_operations",
      candidates: [{
        id: "candidate-fixture-1",
        recordType: "candidate_region",
        latitude: -23.5,
        longitude: -69.3,
        status: "insufficient_evidence",
        screening: { status: "insufficient_evidence", requiredFactors: [], missingFactors: [] },
        evidence: [],
        sources: {
          climate: { status: "success", normalizedDailyPath: "data/processed/climate/candidates/missing.json" },
          terrain: { status: "not_requested" },
          geology: { status: "not_requested" },
        },
      }],
    }));

    const runner = join(projectRoot, "dist/scripts/run-comparison.js");
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      env: {
        ...process.env,
        DISCOVERY_OUTPUT: discoveryPath,
        COMPARISON_ARCHIVE_DIRECTORY: join(data, "processed/comparison-runs"),
        COMPARISON_LATEST_OUTPUT: join(data, "processed/comparison-runs/latest.json"),
        COMPARISON_VALIDATION_OUTPUT: join(data, "processed/comparison-runs/validation-report.json"),
      },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "valid");
    assert.ok(summary.comparisonPairCount > 0);
    const archive = JSON.parse(await readFile(join(data, "processed/comparison-runs", `${summary.runId}.json`), "utf8"));
    assert.ok(archive.comparisons.length > 0);
    const climateFactors = archive.comparisons[0].factors.filter((factor) => ["T2M", "T2M_MAX", "T2M_MIN", "RH2M", "PRECTOTCORR", "WS10M"].includes(factor.factorId));
    assert.ok(climateFactors.length > 0);
    assert.ok(climateFactors.every((factor) => factor.status === "unavailable"));
    assert.ok(climateFactors.every((factor) => /reference.*history|candidate normalized daily climate history/i.test(factor.explanation)));

    const malformedHistory = join(data, "processed/climate/known-sites-daily.json");
    await mkdir(dirname(malformedHistory), { recursive: true });
    await writeFile(malformedHistory, "{ malformed JSON");
    const malformed = spawnSync(process.execPath, [runner], {
      cwd: root,
      env: {
        ...process.env,
        DISCOVERY_OUTPUT: discoveryPath,
        COMPARISON_ARCHIVE_DIRECTORY: join(data, "processed/comparison-runs-malformed"),
        COMPARISON_LATEST_OUTPUT: join(data, "processed/comparison-runs-malformed/latest.json"),
        COMPARISON_VALIDATION_OUTPUT: join(data, "processed/comparison-runs-malformed/validation-report.json"),
      },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.notEqual(malformed.status, 0, "corrupt history must not be treated as an absent optional artifact");
    assert.match(`${malformed.stderr}\n${malformed.stdout}`, /JSON|Unexpected|parse/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
