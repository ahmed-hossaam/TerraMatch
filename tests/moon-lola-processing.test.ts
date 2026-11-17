import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";
import { validateLolaProcessedMetadata } from "../src/moon/validation/lola-processing.js";
import { toMoonLayer } from "../src/moon/map-layers.js";
import { validateMoonDatasetRegistry } from "../src/moon/validation/registry.js";

test("processed LOLA sidecar enforces provenance, NoData mask, relative-height scale, and unresolved CRS", () => {
  const sha = "a".repeat(64);
  const sample = {
    schemaVersion: "1.0.0", product: { datasetId: "moon-lola-global-topography", productId: "LDEM_4", productVersion: "V3.0", dataSetId: "LRO-L-LOLA-4-GDR-V1.0" },
    sources: { jp2: { sha256: sha, byteSize: 1436447 }, pdsLabel: { sha256: sha, byteSize: 6602 }, auxXml: { sha256: sha, byteSize: 2000 } },
    inputArray: { dimensionsLinesSamples: [720, 1440], dtype: "int16" }, output: { dimensionsLinesSamples: [720, 1440], dtype: "float32", byteSize: 4147328, sha256: sha, units: "m" },
    transform: { noDataRule: "Raw DN equal to AUX NoDataValue -32768 becomes Float32 NaN; excluded from statistics.", scaleApplied: 0.5, offsetApplied: 0, formula: "relative surface height (m) = raw DN × 0.5", referenceRadiusM: 1737400, referenceRadiusAppliedToOutput: false },
    coordinateMetadata: { referenceFrame: "DE421", projection: "SIMPLE CYLINDRICAL", latitudeConvention: "unresolved", pixelCenterAndOrientation: "unresolved", geotransform: null, georeferenced: false },
    coverageAndStatistics: { sampleCount: 1036800, validSampleCount: 1036800, noDataSampleCount: 0, noDataLocationsRowColumnZeroBased: [], validSampleStatistics: { minimum: -8879, maximum: 10504, mean: -519.7668, standardDeviationPopulation: 2203.09, median: -796.5, percentiles: { "1": -5320, "5": -3824, "25": -1904, "50": -796.5, "75": 624.5, "95": 3581.5, "99": 5681 } }, geographicValidCoverage: null },
    lifecycle: { processed: true, scientificallyValidated: false, deliveryReady: false, renderable: false, mapReady: false }, unresolvedScientificDetails: ["latitude unresolved", "orientation unresolved"],
  };
  assert.deepEqual(validateLolaProcessedMetadata(sample), []);
  assert.ok(validateLolaProcessedMetadata({ ...sample, transform: { ...sample.transform, referenceRadiusAppliedToOutput: true } }).length > 0);
  assert.ok(validateLolaProcessedMetadata({ ...sample, lifecycle: { ...sample.lifecycle, mapReady: true } }).length > 0);
});

test("actual LOLA sidecar validates and no other Moon family is advanced", async () => {
  const metadata = JSON.parse(await readFile("data/processed/moon/lola/ldem_4_height_m.json", "utf8"));
  assert.deepEqual(validateLolaProcessedMetadata(metadata), []);
  assert.equal(metadata.coverageAndStatistics.sampleCount, metadata.coverageAndStatistics.validSampleCount + metadata.coverageAndStatistics.noDataSampleCount);
  const lola = MOON_DATASETS.find((item) => item.datasetId === "moon-lola-global-topography")!;
  assert.equal(lola.lifecycle.processing, "completed");
  assert.notEqual(lola.lifecycle.validation, "completed");
  assert.notEqual(lola.lifecycle.mapDelivery, "completed");
  assert.equal(toMoonLayer(lola).availability, "not_validated");
  assert.deepEqual(validateMoonDatasetRegistry(MOON_DATASETS), []);
  assert.equal(MOON_DATASETS.filter((item) => item.lifecycle.processing === "completed").length, 1);
});

test("stored NPY is explicitly a Float32 array artifact, not declared georeferenced", async () => {
  const script = await readFile("scripts/moon/process-lola-height.py", "utf8");
  assert.match(script, /np\.save\(f, processed, allow_pickle=False\)/);
  assert.match(script, /georeferenced": False/);
  assert.match(script, /referenceRadiusAppliedToOutput": False/);
});
