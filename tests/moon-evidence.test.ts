import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Moon evidence-gap route is API-driven and covers all dataset registry entries", async () => {
  const app = await readFile("web/src/App.tsx", "utf8");
  const page = await readFile("web/src/MoonEvidencePage.tsx", "utf8");
  assert.match(app, /path="\/moon\/evidence"/);
  assert.match(page, /getMoonDatasets\(\)/);
  assert.match(page, /data\.datasets\.items\.map/);
  for (const field of ["productSelection", "metadataStatus", "lifecycle.acquisition", "lifecycle.inspection", "lifecycle.decoding", "lifecycle.processing", "lifecycle.validation", "mapDelivery", "spatialSupport", "temporalSupport", "quality.status", "limitations"]) assert.ok(page.includes(field), `missing evidence status field ${field}`);
  assert.match(page, /coverageStatus/);
  assert.match(page, /processed into a Float32 relative-height array using the companion AUX NoData and scale metadata/);
});

test("claim boundaries retain source-specific lunar semantics and no suitability scores", async () => {
  const page = await readFile("web/src/MoonEvidencePage.tsx", "utf8");
  assert.match(page, /not lunar air-temperature measurements/);
  assert.match(page, /not direct mineral assays/);
  assert.match(page, /do not establish water ice/);
  assert.match(page, /not uniform global high-resolution coverage/);
  assert.match(page, /not site-scale field truth/);
  assert.match(page, /No Earth–Moon similarity, analog suitability, readiness, or ranking score is calculated/);
});

test("Moon evidence gap layout defines a single-column responsive mode", async () => {
  const css = await readFile("web/src/moon/moon-evidence.css", "utf8");
  assert.match(css, /@media\(max-width:850px\)\{\.moon-evidence-cards\{grid-template-columns:1fr\}\}/);
  assert.match(css, /@media\(max-width:520px\)/);
});
