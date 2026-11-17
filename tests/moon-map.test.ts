import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMoonMapConfiguration, toMoonMapPosition } from "../web/src/moon/moon-map-adapter.js";
import { getDefaultMoonMapLayers, getRenderableMoonLayers } from "../web/src/moon/moon-map-layers.js";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";
import { toMoonLayer } from "../src/moon/map-layers.js";
import { validateMoonDatasetRegistry } from "../src/moon/validation/registry.js";

test("Moon map config enforces lunar geographic CRS and exposes no Earth basemap", () => {
  const config = createMoonMapConfiguration();
  assert.equal(config.destinationId, "moon");
  assert.equal(config.coordinateReference.targetBody, "moon");
  assert.equal(config.coordinateReference.latitudeType, "planetocentric");
  assert.equal(config.coordinateReference.longitudeDirection, "positive_east");
  assert.equal(config.coordinateReference.longitudeDomain, "-180_180");
  assert.equal(config.coordinateReference.referenceRadiusM, 1737400);
  assert.equal(config.projection, "geographic");
  assert.equal(config.basemapId, null);
  assert.equal(config.prototype, true);
});

test("Moon map positions use Phase 2 longitude wrapping and coordinate validity", () => {
  assert.deepEqual(toMoonMapPosition(190, 0), { x: -170, y: -0 });
  assert.deepEqual(toMoonMapPosition(-180, 90), { x: -180, y: -90 });
  assert.throws(() => toMoonMapPosition(0, 91), /latitude/);
});

test("registered families map to honest non-renderable states, separating processed-but-unvalidated LOLA from absent sources", () => {
  const layers = getDefaultMoonMapLayers();
  assert.equal(layers.length, 13);
  assert.equal(new Set(layers.map((layer) => layer.datasetId)).size, 13);
  assert.equal(getRenderableMoonLayers(layers).length, 0);
  assert.equal(layers.filter((layer) => layer.availability === "not_acquired").length, 12);
  assert.equal(layers.find((layer) => layer.datasetId === "moon-lola-global-topography")?.availability, "not_validated");
  assert.equal(layers.find((layer) => layer.datasetId === "moon-lola-global-topography")?.decodingState, "completed");
  assert.equal(layers.find((layer) => layer.datasetId === "moon-lola-global-topography")?.processingState, "completed");
  assert.ok(layers.every((layer) => layer.coordinateReference.targetBody === "moon"));
  assert.ok(layers.every((layer) => layer.limitations.length > 0));
  assert.deepEqual(layers.map((layer) => layer.datasetId).sort(), MOON_DATASETS.map((dataset) => dataset.datasetId).sort());
});

test("inspection, processing, validation, and delivery are separate map readiness gates", () => {
  const base = structuredClone(MOON_DATASETS[0]);
  base.lifecycle.acquisition = "acquired";
  base.checksum.status = "verified";
  base.lifecycle.inspection = "not_started";
  base.lifecycle.decoding = "not_started";
  base.lifecycle.processing = "not_started";
  assert.equal(toMoonLayer(base).availability, "not_inspected");
  base.lifecycle.inspection = "completed";
  base.lifecycle.decoding = "completed";
  assert.equal(toMoonLayer(base).availability, "not_processed");
  base.lifecycle.processing = "completed";
  assert.equal(toMoonLayer(base).availability, "not_validated");
  base.lifecycle.validation = "completed";
  assert.equal(toMoonLayer(base).availability, "not_delivery_ready");
  base.lifecycle.mapDelivery = "completed";
  assert.equal(toMoonLayer(base).availability, "renderable");
  const unsafe = structuredClone(base);
  unsafe.lifecycle.inspection = "not_started";
  assert.ok(validateMoonDatasetRegistry([unsafe]).some((error) => error.includes("before acquisition, inspection")));
});

test("Moon prototype does not import Earth imagery or fabricate surface features", async () => {
  const source = await readFile("web/src/moon/MoonMapView.tsx", "utf8");
  assert.match(source, /config\.prototypeNotice/);
  assert.match(source, /no acquired lunar feature data/);
  assert.ok(!/services\.arcgisonline|world-atlas|candidate_region|known_analog/.test(source));
});

test("Moon route is wired to API-driven page and preserves the separate Mars route", async () => {
  const app = await readFile("web/src/App.tsx", "utf8");
  const page = await readFile("web/src/MoonPage.tsx", "utf8");
  const client = await readFile("web/src/moon/moon-api.ts", "utf8");
  assert.match(app, /path="\/moon"/);
  assert.match(app, /path="\/mars-evidence"/);
  assert.match(app, /<NavLink to="\/moon">Moon<\/NavLink>/);
  assert.match(page, /getMoonSummary\(\).*getMoonDatasets\(\).*getMoonLayers\(\).*getMoonCoverage\(\).*getMoonMapConfig\(\)/s);
  assert.match(client, /import \{ api \} from "\.\.\/api\.js"/);
});
