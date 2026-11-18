import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DESTINATIONS } from "../src/destinations/registry.js";
import { validateDestinationRegistry } from "../src/destinations/validate.js";
import { projectLunarCoordinate, unprojectLunarCoordinate, toPositiveEast, fromPositiveEast, CoordinateTransformError } from "../src/moon/coordinates.js";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";
import { validateCurrentMoonRegistry, validateMoonDatasetRegistry, validateCoverageSummary, validateDerivedProductLineage } from "../src/moon/validation/registry.js";
import { validateRemsAirTemperatureArtifact } from "../src/mars/rems.js";

const lola = MOON_DATASETS.find((dataset) => dataset.datasetId === "moon-lola-global-topography")!;
function throwsCode(run: () => unknown, code: string) {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  assert.ok(caught instanceof CoordinateTransformError);
  assert.equal((caught as CoordinateTransformError).code, code);
}

test("destination registry includes Earth, Mars, and Moon without widening Mars profile", () => {
  assert.deepEqual(validateDestinationRegistry(), []);
  assert.deepEqual(DESTINATIONS.map((item) => item.id), ["earth", "mars", "moon"]);
  assert.equal(DESTINATIONS.find((item) => item.id === "mars")?.missionProfiles[0], "mars-surface-analog-requirements");
  assert.equal(DESTINATIONS.find((item) => item.id === "moon")?.apiNamespace, "/api/moon");
});

test("Moon active catalog contains only acquired checksum-verified products", () => {
  assert.deepEqual(MOON_DATASETS.map((dataset) => dataset.datasetId), ["moon-lola-global-topography"]);
  assert.deepEqual(validateCurrentMoonRegistry(), []);
  assert.ok(MOON_DATASETS.every((dataset) => dataset.lifecycle.registration === "completed"));
  assert.ok(MOON_DATASETS.every((dataset) => dataset.lifecycle.acquisition === "acquired" && dataset.checksum.status === "verified" && /^[a-f0-9]{64}$/i.test(dataset.checksum.value ?? "")));
  assert.equal(lola.lifecycle.decoding, "completed");
  assert.equal(MOON_DATASETS.filter((dataset) => dataset.lifecycle.processing === "completed").length, 1);
  assert.equal(lola.lifecycle.validation, "blocked");
  assert.equal(lola.coordinateReference.latitudeType, "planetocentric");
  assert.match(lola.downloadUrl ?? "", /ldem_4\.jp2$/);
  assert.equal(lola.lifecycle.mapDelivery, "not_started");
  assert.equal(lola.coordinateReference.referenceRadiusM, 1_737_400);
  assert.equal(lola.spatialSupport.coverageClass, "global");
  const unacquired = structuredClone(lola);
  unacquired.lifecycle.acquisition = "not_acquired";
  assert.ok(validateMoonDatasetRegistry([unacquired]).some((error) => error.includes("must not appear in the active catalog")));
});

test("retained LOLA processed artifact exists and matches its sidecar size and SHA-256", async () => {
  const sidecar = JSON.parse(await readFile("data/processed/moon/lola/ldem_4_height_m.json", "utf8"));
  const bytes = await readFile("data/processed/moon/lola/ldem_4_height_m.npy");
  assert.equal(bytes.byteLength, sidecar.output.byteSize);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sidecar.output.sha256.toLowerCase());
  assert.equal(sidecar.sources.jp2.sha256.toLowerCase(), lola.checksum.value?.toLowerCase());
  assert.equal(sidecar.sources.jp2.expectedIntegrityMatched, true);
  assert.equal(sidecar.sources.pdsLabel.expectedIntegrityMatched, true);
});

test("registry validator rejects duplicate IDs and incomplete scientific metadata", () => {
  const duplicate = structuredClone(MOON_DATASETS[0]);
  assert.ok(validateMoonDatasetRegistry([duplicate, duplicate]).some((error) => error.includes("duplicated")));
  const incomplete = structuredClone(MOON_DATASETS[0]) as any;
  incomplete.coordinateReference.targetBody = "earth";
  incomplete.variables[0].semantics = "";
  incomplete.license.status = "invented";
  assert.ok(validateMoonDatasetRegistry([incomplete]).some((error) => error.includes("coordinateReference")));
  assert.ok(validateMoonDatasetRegistry([incomplete]).some((error) => error.includes("semantics")));
  const unsafeDownload = structuredClone(MOON_DATASETS[0]) as any;
  unsafeDownload.downloadUrl = "file:///outside/moon.img";
  assert.ok(validateMoonDatasetRegistry([unsafeDownload]).some((error) => error.includes("downloadUrl")));
  const invalidSize = structuredClone(MOON_DATASETS[0]) as any;
  invalidSize.advertisedPackageSizeBytes = -1;
  assert.ok(validateMoonDatasetRegistry([invalidSize]).some((error) => error.includes("advertisedPackageSizeBytes")));
});

test("lunar longitude direction conversion and wrapping respect declared domain", () => {
  assert.deepEqual(toPositiveEast({ longitude: 190, latitude: 0 }, "positive_east", "-180_180"), { longitude: -170, latitude: 0 });
  assert.deepEqual(toPositiveEast({ longitude: 30, latitude: 0 }, "positive_west", "-180_180"), { longitude: -30, latitude: 0 });
  assert.deepEqual(fromPositiveEast({ longitude: -30, latitude: 1 }, "positive_west", "-180_180"), { longitude: 30, latitude: 1 });
  assert.equal(toPositiveEast({ longitude: -1, latitude: 0 }, "positive_east", "0_360").longitude, 359);
  assert.equal(toPositiveEast({ longitude: 180, latitude: 0 }, "positive_east", "-180_180").longitude, 180);
});

test("spherical lunar Mercator round-trips and rejects poles, invalid inputs, and unsupported projections", () => {
  const reference = lola.coordinateReference;
  const input = { longitude: 179.75, latitude: 48.25 };
  const projected = projectLunarCoordinate(input, reference, "lunar_spherical_mercator");
  assert.ok("x" in projected);
  const result = unprojectLunarCoordinate(projected, reference, "lunar_spherical_mercator");
  assert.ok("longitude" in result && "latitude" in result);
  assert.ok(Math.abs(result.longitude - input.longitude) < 1e-9);
  assert.ok(Math.abs(result.latitude - input.latitude) < 1e-9);
  throwsCode(() => projectLunarCoordinate({ longitude: 0, latitude: 90 }, reference, "lunar_spherical_mercator"), "MERCATOR_POLE");
  throwsCode(() => projectLunarCoordinate({ longitude: 0, latitude: 91 }, reference, "geographic"), "INVALID_COORDINATE");
  throwsCode(() => projectLunarCoordinate({ longitude: Number.NaN, latitude: 0 }, reference, "geographic"), "INVALID_COORDINATE");
  throwsCode(() => projectLunarCoordinate({ longitude: 1, latitude: 1 }, reference, "polar_stereographic"), "UNSUPPORTED_PROJECTION");
  throwsCode(() => projectLunarCoordinate({ longitude: 1, latitude: 1 }, { ...reference, longitudeDirection: "unknown" }, "geographic"), "UNKNOWN_COORDINATE_REFERENCE");
});

test("coverage, product lineage, and missing-data semantics remain explicit", () => {
  const goodCoverage = { nominalFootprint: 1, observedDataCoverage: null, validDataCoverage: null, interpolatedCoverage: null, unobservedCoverage: null, units: "fraction" as const, method: "not computed from files", status: "unknown" as const };
  assert.deepEqual(validateCoverageSummary(goodCoverage), []);
  assert.ok(validateCoverageSummary({ ...goodCoverage, validDataCoverage: 1 }).length > 0);
  const lineage = { derivedProductId: "test", schemaVersion: "1.0.0" as const, inputDatasetId: "d", inputProductId: "p", inputProductVersion: "1", inputSha256: "a".repeat(64), processingCodeVersion: "1", transformations: ["unit conversion"], outputUnits: { height: "m" }, coordinateReference: lola.coordinateReference, nodataPolicy: "preserve nulls", generatedAt: new Date().toISOString(), outputSha256: "b".repeat(64) };
  assert.deepEqual(validateDerivedProductLineage(lineage), []);
  assert.ok(validateDerivedProductLineage({ ...lineage, inputSha256: "bad" }).length > 0);
});

test("Mars REMS artifact and Earth archive remain in their existing independent contracts", async () => {
  const rems = JSON.parse(await readFile("data/processed/mars/rems-air-temperature-v1.json", "utf8"));
  assert.deepEqual(validateRemsAirTemperatureArtifact(rems), []);
  const references = JSON.parse(await readFile("data/processed/reference-sites.json", "utf8"));
  const records = Array.isArray(references) ? references : references.records;
  assert.equal(records.length, 31);
  assert.ok(records.every((record: any) => record.planet === "Earth"));
  const marsProfile = JSON.parse(await readFile("data/mission-profiles/mars-surface-v1.json", "utf8"));
  assert.equal(marsProfile.targetPlanet, "Mars");
  assert.equal(marsProfile.dimensions.flatMap((dimension: any) => dimension.factors).length, 19);
});
