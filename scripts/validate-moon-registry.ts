import { writeFile } from "node:fs/promises";
import { MOON_DATASETS, MOON_REGISTRY_VERSION } from "../src/moon/registry/dataset-registry.js";
import { validateCurrentMoonRegistry } from "../src/moon/validation/registry.js";

const errors = validateCurrentMoonRegistry();
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
