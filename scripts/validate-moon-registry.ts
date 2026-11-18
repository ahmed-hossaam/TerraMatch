import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { MOON_DATASETS, MOON_REGISTRY_VERSION } from "../src/moon/registry/dataset-registry.js";
import { validateCurrentMoonRegistry } from "../src/moon/validation/registry.js";

const errors = validateCurrentMoonRegistry();
if (MOON_DATASETS.some((item) => item.datasetId === "moon-lola-global-topography")) {
  try {
    const metadata = JSON.parse(await readFile("data/processed/moon/lola/ldem_4_height_m.json", "utf8"));
    const artifact = await readFile("data/processed/moon/lola/ldem_4_height_m.npy");
    const digest = createHash("sha256").update(artifact).digest("hex");
    const artifactStat = await stat("data/processed/moon/lola/ldem_4_height_m.npy");
    if (artifactStat.size !== metadata.output.byteSize) errors.push("LOLA processed artifact byte size does not match its metadata sidecar.");
    if (digest !== metadata.output.sha256.toLowerCase()) errors.push("LOLA processed artifact SHA-256 does not match its metadata sidecar.");
    if (metadata.sources.jp2.sha256.toLowerCase() !== MOON_DATASETS.find((item) => item.datasetId === "moon-lola-global-topography")?.checksum.value?.toLowerCase()) errors.push("LOLA registry source checksum does not match the processed artifact provenance.");
  } catch (error) {
    errors.push(`LOLA acquired/processed artifact integrity check failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
const report = {
  schemaVersion: "1.0.0", registryVersion: MOON_REGISTRY_VERSION, generatedAt: new Date().toISOString(),
  datasetCount: MOON_DATASETS.length,
  acquiredCount: MOON_DATASETS.filter((item) => item.lifecycle.acquisition === "acquired").length,
  processedCount: MOON_DATASETS.filter((item) => item.lifecycle.processing === "completed").length,
  validatedCount: MOON_DATASETS.filter((item) => item.lifecycle.validation === "completed").length,
  mapReadyCount: MOON_DATASETS.filter((item) => item.lifecycle.mapDelivery === "completed").length,
  coverage: MOON_DATASETS.map((item) => ({ datasetId: item.datasetId, declaredFootprint: item.spatialSupport.coverageClass, nominalResolution: item.spatialSupport.nominalResolution, effectiveResolution: item.spatialSupport.effectiveResolution, observedCoverageStatus: item.spatialSupport.validCoverage, interpolatedCoverageStatus: item.spatialSupport.interpolatedCoverage, computedCoverage: null, acquisition: item.lifecycle.acquisition, processing: item.lifecycle.processing, validation: item.lifecycle.validation, mapDelivery: item.lifecycle.mapDelivery })),
  errors,
  status: errors.length ? "invalid" : "valid",
};
const output = process.env.MOON_REGISTRY_VALIDATION_OUTPUT;
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
