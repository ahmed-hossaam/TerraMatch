import test from "node:test";
import assert from "node:assert/strict";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";
import { validateMoonDatasetRegistry } from "../src/moon/validation/registry.js";
import { validateLolaDecodeDiagnostics } from "../src/moon/validation/lola-diagnostics.js";
import { toMoonLayer } from "../src/moon/map-layers.js";

// Contract-only fixture; it is not a decoder output and contains no source-derived samples.
const fixture = {
  schemaVersion: "1.0.0",
  product: { datasetId: "moon-lola-global-topography", productId: "LDEM_4", productVersion: "V3.0", dataSetId: "LRO-L-LOLA-4-GDR-V1.0" },
  source: {
    jp2: { byteSize: 1_436_447, sha256: "9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3", expectedIntegrityMatched: true },
    label: { byteSize: 6_602, sha256: "102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8", expectedIntegrityMatched: true },
  },
  execution: { pythonVersion: "3.14.5", imagecodecsVersion: "2026.11.11", numpyVersion: "2.5.5", decoder: "imagecodecs.jpeg2k_decode", executedAtUtc: "2026-11-17T00:00:00Z" },
  decodedFacts: { decodeSucceeded: true, shapeLinesSamples: [720, 1440], dtype: "int16", sampleKind: "signed integer", sampleBits: 16, totalSampleCount: 1_036_800, finiteSampleCount: 1_036_800, rawStatistics: { minimum: -17_758, maximum: 21_008, mean: -1039.5337094907406, standardDeviationPopulation: 4406.185206969532, median: 0, percentiles: { "1": -1, "5": -1, "25": 0, "50": 0, "75": 1, "95": 1, "99": 1 } }, extremeSampleCounts: { minimumValue: -17_758, minimumCount: 1, maximumValue: 21_008, maximumCount: 1 }, samplePositions: { indexing: "zero-based row, column; raw decoder samples; no physical transform", values: [{ rowZeroBased: 0, columnZeroBased: 0, rawValue: -74 }] }, firstFiveRowsFirstTenColumns: Array.from({ length: 5 }, () => Array.from({ length: 10 }, () => 0)) },
  pdsLabelDeclarations: { declaredLines: 720, declaredLineSamples: 1440, sampleType: "LSB_INTEGER", sampleBits: 16, declaredMinimum: -17_758, declaredMaximum: 21_008, decodedExtremaMatchLabel: true, missingConstantPresent: false, missingValuePresent: false },
  unresolvedInterpretations: ["shape vs height", "NoData", "orientation"],
  processingStatus: { processed: false, scientificallyValidated: false, deliveryReady: false, renderable: false, mapReady: false, physicalTransformApplied: false },
} as const;

test("LOLA diagnostics contract accepts raw decoded facts while preserving scientific unknowns", () => {
  assert.deepEqual(validateLolaDecodeDiagnostics(fixture), []);
  assert.ok(validateLolaDecodeDiagnostics({ ...fixture, processingStatus: { ...fixture.processingStatus, mapReady: true } }).includes("Pixel decoding cannot imply processing, validation, delivery, or map readiness."));
  assert.ok(validateLolaDecodeDiagnostics({ ...fixture, source: { ...fixture.source, jp2: { ...fixture.source.jp2, byteSize: 1 } } }).some((error) => error.includes("integrity")));
});

test("LOLA processing does not imply scientific validation or map delivery", () => {
  const lola = MOON_DATASETS.find((dataset) => dataset.datasetId === "moon-lola-global-topography")!;
  assert.equal(lola.lifecycle.acquisition, "acquired");
  assert.equal(lola.lifecycle.inspection, "completed");
  assert.equal(lola.lifecycle.decoding, "completed");
  assert.equal(lola.lifecycle.processing, "completed");
  assert.notEqual(lola.lifecycle.validation, "completed");
  assert.notEqual(lola.lifecycle.mapDelivery, "completed");
  assert.equal(toMoonLayer(lola).availability, "not_validated");
  assert.deepEqual(validateMoonDatasetRegistry(MOON_DATASETS), []);
});
