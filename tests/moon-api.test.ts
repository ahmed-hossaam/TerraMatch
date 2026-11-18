import test from "node:test";
import assert from "node:assert/strict";
import { moonApiResponse } from "../src/moon/api.js";
import { MOON_DATASETS } from "../src/moon/registry/dataset-registry.js";

test("Moon API summary distinguishes processed LOLA samples from validated or map-ready data", () => {
  const response = moonApiResponse("/api/moon/summary")!;
  assert.equal(response.status, 200);
  const body = response.body as any;
  assert.equal(body.destination.id, "moon");
  assert.equal(body.counts.registered, 1);
  assert.equal(body.counts.acquired, 1);
  assert.equal(body.counts.inspected, 1);
  assert.equal(body.counts.decoded, 1);
  assert.equal(body.counts.processed, 1);
  assert.equal(body.counts.validated, 0);
  assert.equal(body.counts.renderable, 0);
  assert.equal(body.counts.researchPreviews, 3);
  assert.equal(body.readiness, "unvalidated_research_preview_available");
  assert.ok(body.knownGaps.some((gap: string) => gap.includes("NoData-masked Float32 relative-height array")));
  assert.ok(body.knownGaps.some((gap: string) => gap.includes("not an independently validated scientific layer")));
  assert.ok(body.knownGaps.some((gap: string) => gap.includes("standard lunar geospatial delivery remain incomplete")));
});

test("LOLA research preview API exposes verified display metadata without a local path", () => {
  const response = moonApiResponse("/api/moon/lola/preview")!;
  assert.equal(response.status, 200);
  assert.equal(response.body.previewStatus, "unvalidated_research_preview");
  assert.equal((response.body.image as any).width, 1440);
  assert.equal((response.body.image as any).height, 720);
  assert.equal((response.body.scientificStatus as any).mapReady, false);
  assert.equal(response.body.dataPathExposed, false);
  assert.ok(!JSON.stringify(response.body).includes("F:\\"));
});

test("LOLA polar preview API exposes both real derived projections without asserting scientific readiness", () => {
  const response = moonApiResponse("/api/moon/lola/polar-previews")!;
  assert.equal(response.status, 200);
  assert.equal(response.body.previewStatus, "unvalidated_research_preview");
  assert.equal(response.body.dataPathExposed, false);
  const projections = response.body.projections as any[];
  assert.deepEqual(projections.map((projection) => projection.hemisphere), ["north", "south"]);
  for (const projection of projections) {
    assert.equal(projection.projection.name, "spherical polar stereographic display");
    assert.equal(projection.image.width, 700);
    assert.equal(projection.image.height, 700);
    assert.equal(projection.scientificStatus.independentPointValidation, false);
    assert.equal(projection.scientificStatus.scientificallyValidated, false);
    assert.equal(projection.scientificStatus.mapReady, false);
    assert.ok(!JSON.stringify(projection).includes("data/processed/moon"));
  }
});

test("Moon dataset catalog is paginated and excludes local paths", () => {
  const page = moonApiResponse("/api/moon/datasets", new URLSearchParams("offset=0&limit=100"))!;
  assert.equal(page.status, 200);
  assert.equal((page.body.items as unknown[]).length, 1);
  assert.equal((page.body.pagination as any).total, 1);
  assert.deepEqual((page.body.items as any[]).map((item) => item.datasetId), ["moon-lola-global-topography"]);
  assert.ok(!(page.body.items as any[]).some((item) => item.datasetId !== "moon-lola-global-topography"));
  const serialized = JSON.stringify(moonApiResponse("/api/moon/datasets")!.body);
  assert.ok(!/F:\\\\|\/home\/|\.env|BLOB_READ_WRITE_TOKEN|DATABASE_URL/.test(serialized));
});

test("Moon details distinguish unknown IDs and invalid encodings", () => {
  assert.deepEqual(moonApiResponse("/api/moon/datasets/not-registered"), { status: 404, body: { error: "No Moon dataset is registered with that ID.", code: "UNKNOWN_DATASET" } });
  assert.equal(moonApiResponse("/api/moon/datasets/%E0%A4%A")?.status, 400);
  const detail = moonApiResponse(`/api/moon/datasets/${MOON_DATASETS[0].datasetId}`)!;
  assert.equal(detail.status, 200);
  assert.equal((detail.body.dataset as any).datasetId, MOON_DATASETS[0].datasetId);
});

test("Moon coverage keeps measured/valid/derived fractions unknown until files are assessed", () => {
  const response = moonApiResponse("/api/moon/coverage")!;
  assert.equal(response.status, 200);
  const datasets = (response.body.datasets as any[]);
  assert.equal(datasets.length, 1);
  assert.ok(datasets.every((entry) => entry.observedDataCoverage === null && entry.validDataCoverage === null && entry.interpolatedOrDerivedCoverage === null && entry.nodataOrUnobservedCoverage === null));
});

test("Moon layers separate unavailable registered families from renderable layers", () => {
  const response = moonApiResponse("/api/moon/layers")!;
  assert.equal(response.status, 200);
  assert.equal((response.body.renderableLayers as unknown[]).length, 0);
  assert.equal((response.body.registeredButUnavailableLayers as unknown[]).length, 1);
  const unavailable = response.body.registeredButUnavailableLayers as any[];
  assert.equal(unavailable.find((layer) => layer.datasetId === "moon-lola-global-topography")?.availability, "not_validated");
  const config = moonApiResponse("/api/moon/map-config")!;
  assert.equal(config.status, 200);
  assert.equal(config.body.basemapId, null);
  assert.equal(config.body.tileService, null);
  assert.equal(config.body.prototype, true);
});

test("Moon API fails safely for wrong methods and unknown endpoints", () => {
  assert.equal(moonApiResponse("/api/moon/summary", new URLSearchParams(), "POST")?.status, 405);
  assert.equal(moonApiResponse("/api/moon/features")?.status, 404);
  assert.equal(moonApiResponse("/api/summary"), null);
});
