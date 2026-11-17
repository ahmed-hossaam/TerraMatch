import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateMoonAcquisitionManifest } from "../src/moon/validation/acquisition-manifest.js";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";

const label = MOON_DATASETS.find((item) => item.datasetId === "moon-usgs-unified-geology")!;
const valid = {
  schemaVersion: "1.0.0", datasetId: label.datasetId, productId: "SYNTHETIC-TEST-FIXTURE", productVersion: "fixture-v1", release: null,
  provider: "TEST FIXTURE — NOT SCIENTIFIC DATA", instrument: null, sourceUrl: "https://example.test/fixture.zip", retrievedAt: "2026-01-01T00:00:00Z", verifiedAt: "2026-01-01T00:01:00Z",
  originalFilename: "fixture.bin", artifactId: "test-fixture-001", storage: "external_local_cache", format: "binary fixture", byteSize: 42,
  checksum: { algorithm: "SHA-256", value: "a".repeat(64), officialValue: null, status: "verified" },
  coordinateReference: label.coordinateReference, variables: [{ name: "fixture value", units: null, semantics: "Synthetic fixture only; not an observation." }],
  nodata: null, qualityMetadata: [], license: { status: "unverified", terms: null, redistribution: null },
  attribution: { citation: null, url: null }, limitations: ["Test fixture is not a source product."], acquisitionResult: "acquired",
} as const;

test("acquisition manifest preserves provenance, checksum, units, and explicit uncertainty states", () => {
  assert.deepEqual(validateMoonAcquisitionManifest(valid), []);
});

test("actual LOLA acquisition manifest preserves verified source hashes without inventing retrieval time", async () => {
  const manifest = JSON.parse(await readFile("data/raw/moon/acquisition-manifests/lola-ldem-4-v3.json", "utf8"));
  assert.deepEqual(validateMoonAcquisitionManifest(manifest), []);
  assert.equal(manifest.datasetId, "moon-lola-global-topography");
  assert.equal(manifest.retrievedAt, null);
  assert.equal(manifest.byteSize, 1436447);
  assert.equal(manifest.checksum.value, "9193828f6fc311e858a9f30ca8a29f91948805993a1475c6d2165e290f167fe3");
  assert.equal(manifest.companionArtifacts[0].byteSize, 6602);
  assert.equal(manifest.companionArtifacts[0].checksum.value, "102122e68a0cca9106fe0067d2e5027714d244ffdec87f04fa292a211f0ef4c8");
  assert.equal(manifest.inspection.jp2Header.pixelDecodingPerformed, false);
});

test("manifest rejects missing provenance, invalid checksum, incomplete CRS, and path/secret leakage", () => {
  assert.ok(validateMoonAcquisitionManifest({ ...valid, sourceUrl: "file:///private/source", checksum: { ...valid.checksum, value: "bad" } }).length > 0);
  assert.ok(validateMoonAcquisitionManifest({ ...valid, artifactId: "C:\\Users\\local\\secret.img" }).some((error) => error.includes("path")));
  assert.ok(validateMoonAcquisitionManifest({ ...valid, coordinateReference: { ...valid.coordinateReference, projection: "unknown" } }).some((error) => error.includes("CRS")));
  assert.ok(validateMoonAcquisitionManifest({ ...valid, variables: [{ name: "x", units: null, semantics: "" }] }).some((error) => error.includes("variables")));
});

test("manifest rejects unsupported lifecycle outcomes and unsafe storage references", () => {
  assert.ok(validateMoonAcquisitionManifest({ ...valid, storage: "repository", acquisitionResult: "planned" }).length >= 2);
  assert.ok(validateMoonAcquisitionManifest({ ...valid, acquisitionResult: "acquired", sourceUrl: "https://example.test", provider: "DATABASE_URL=secret" }).some((error) => error.includes("secret")));
});
