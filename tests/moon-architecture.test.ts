import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DESTINATIONS } from "../src/destinations/registry.js";
import { validateDestinationRegistry } from "../src/destinations/validate.js";
import { projectLunarCoordinate, unprojectLunarCoordinate, toPositiveEast, fromPositiveEast, CoordinateTransformError } from "../src/moon/coordinates.js";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";
import { validateCurrentMoonRegistry, validateMoonDatasetRegistry, validateCoverageSummary, validateDerivedProductLineage } from "../src/moon/validation/registry.js";
import { validateRemsAirTemperatureArtifact } from "../src/mars/rems.js";

const usgs = MOON_DATASETS.find((dataset) => dataset.datasetId === "moon-usgs-unified-geology")!;
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

test("Moon registry contains all 13 globally scoped product families with honest lifecycle states", () => {
  assert.equal(MOON_DATASETS.length, 13);
  assert.deepEqual(validateCurrentMoonRegistry(), []);
  assert.ok(MOON_DATASETS.every((dataset) => dataset.lifecycle.registration === "completed"));
  assert.equal(MOON_DATASETS.filter((dataset) => dataset.lifecycle.acquisition === "acquired").length, 1);
  assert.equal(MOON_DATASETS.find((dataset) => dataset.datasetId === "moon-lola-global-topography")?.lifecycle.decoding, "completed");
  assert.equal(MOON_DATASETS.filter((dataset) => dataset.lifecycle.acquisition === "not_acquired").length, 12);
  assert.equal(MOON_DATASETS.filter((dataset) => dataset.lifecycle.processing === "completed").length, 1);
  assert.equal(MOON_DATASETS.find((dataset) => dataset.datasetId === "moon-lola-global-topography")?.lifecycle.validation, "blocked");
  assert.equal(usgs.spatialSupport.coverageClass, "global");
  assert.equal(usgs.coordinateReference.referenceRadiusM, 1_737_400);
  assert.equal(usgs.coordinateReference.latitudeType, "planetocentric");
  assert.equal(usgs.coordinateReference.longitudeDirection, "positive_east");
  assert.equal(usgs.coordinateReference.projection, "lunar_spherical_mercator");
  assert.equal(MOON_DATASETS.find((item) => item.datasetId === "moon-permanently-shadowed-regions")?.spatialSupport.coverageClass, "polar");
  assert.equal(MOON_DATASETS.find((item) => item.datasetId === "moon-lroc-nac-imaging")?.spatialSupport.coverageClass, "targeted");
  assert.ok(MOON_DATASETS.find((item) => item.datasetId === "moon-lro-diviner-thermal")?.limitations.some((item) => item.includes("different periods")));
  assert.ok(MOON_DATASETS.find((item) => item.datasetId === "moon-lro-lend-hydrogen")?.limitations.some((item) => item.includes("not a water-ice detection")));
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
});

test("lunar longitude direction conversion and wrapping respect declared domain", () => {
  assert.deepEqual(toPositiveEast({ longitude: 190, latitude: 0 }, "positive_east", "-180_180"), { longitude: -170, latitude: 0 });
  assert.deepEqual(toPositiveEast({ longitude: 30, latitude: 0 }, "positive_west", "-180_180"), { longitude: -30, latitude: 0 });
  assert.deepEqual(fromPositiveEast({ longitude: -30, latitude: 1 }, "positive_west", "-180_180"), { longitude: 30, latitude: 1 });
  assert.equal(toPositiveEast({ longitude: -1, latitude: 0 }, "positive_east", "0_360").longitude, 359);
  assert.equal(toPositiveEast({ longitude: 180, latitude: 0 }, "positive_east", "-180_180").longitude, 180);
});

test("spherical lunar Mercator round-trips and rejects poles, invalid inputs, and unsupported projections", () => {
  const reference = usgs.coordinateReference;
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
  const lineage = { derivedProductId: "test", schemaVersion: "1.0.0" as const, inputDatasetId: "d", inputProductId: "p", inputProductVersion: "1", inputSha256: "a".repeat(64), processingCodeVersion: "1", transformations: ["unit conversion"], outputUnits: { height: "m" }, coordinateReference: usgs.coordinateReference, nodataPolicy: "preserve nulls", generatedAt: new Date().toISOString(), outputSha256: "b".repeat(64) };
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
