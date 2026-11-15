import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { groupMeteorCraterMountChemistry } from "../src/evidence/supplemental-acquisition.js";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

test("Meteor Crater table observations preserve particle, mount, and reported-average semantics", async () => {
  const acquisition = await readJson("data/evidence/m2/normalized/site-acquisitions-v1.json");
  const rows = acquisition.records.filter((row: any) => row.sourceId === "usgs-publications");
  assert.equal(rows.length, 195);
  assert.equal(new Set(rows.map((row: any) => row.sampleLabel)).size, 15);
  assert.deepEqual([...new Set(rows.map((row: any) => row.parameter))].sort(), ["Al2O3", "CaO", "Cr2O3", "FeO", "K2O", "MgO", "MnO", "Na2O", "NiO", "P2O5", "SiO2", "TiO2", "Total"].sort());
  assert.equal(rows.filter((row: any) => row.recordContext.measurementInterpretation === "reported_average").length, 180);
  assert.equal(rows.filter((row: any) => row.parameter === "Total" && row.basis === "derived_value" && row.recordContext.measurementInterpretation === "reported_analytical_total").length, 15);
  assert.ok(rows.every((row: any) => row.unit === "wt%" && row.method.includes("WDS") && row.latitude === null && row.longitude === null && row.factorId === null && row.pointComparisonEligible === false));
  assert.ok(rows.every((row: any) => row.recordContext.sourceRecordCount === 195 && row.recordContext.sampleCount === 15 && row.recordContext.measurementCount === null && row.recordContext.reportedValueCount === 180 && row.recordContext.distinctLocationCount === 4 && row.recordContext.distinctLocationUnit === "drill_hole_contexts"));
  const mounts = groupMeteorCraterMountChemistry(rows);
  assert.equal(mounts.length, 15);
  assert.ok(mounts.every((mount: any) => Object.keys(mount.values).length === 13));
  const raw = await readFile("data/evidence/m2/raw/usgs/ofr2024-1062-full.html", "utf8");
  assert.match(raw, /We analyzed 15 impact-melt particles that had pristine glass/);
  assert.match(raw, /each mount is composed of fragments from only one impact-melt particle/);
  assert.match(raw, /ranged in depth from ~0\.5 to 6\.4 m/);
});

test("GEOROC rows are four analyses of one labeled sample with regional-only geography", async () => {
  const acquisition = await readJson("data/evidence/m2/normalized/site-acquisitions-v1.json");
  const rows = acquisition.records.filter((row: any) => row.sourceId === "georoc");
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map((row: any) => row.sampleLabel)).size, 1);
  assert.equal(rows[0].sampleLabel, "samp. SDV-1");
  assert.deepEqual(rows.map((row: any) => row.value).sort((a: number, b: number) => a - b), [0.63, 0.75, 20.6, 27.58]);
  assert.ok(rows.every((row: any) => row.parameter === "FEOT" && row.unit === "wt%" && row.method === "EMP (EPMA)"));
  assert.equal(new Set(rows.map((row: any) => `${row.mineralOrComponent}/${row.mineralPosition}`)).size, 4);
  assert.ok(rows.every((row: any) => row.latitude === null && row.longitude === null && row.sourceCoordinateBounds.latitudeMin === 37 && row.sourceCoordinateBounds.latitudeMax === 38.5 && row.sourceCoordinateBounds.longitudeMin === 14 && row.sourceCoordinateBounds.longitudeMax === 16));
  assert.ok(rows.every((row: any) => row.recordContext.sampleCount === 1 && row.recordContext.measurementCount === 4 && row.recordContext.reportedValueCount === 4 && row.recordContext.distinctLocationCount === null && row.state === "not_representative" && row.spatialRelationship === "regional_context" && row.pointComparisonEligible === false));
  assert.ok(rows.every((row: any) => row.citation.doi === "10.1016/j.gca.2004.01.016"));
  const raw = await readFile("data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv", "utf8");
  assert.equal((raw.match(/samp\. SDV-1/g) ?? []).length, 4);
  assert.match(raw, /LATITUDE \(MIN\.\).*LATITUDE \(MAX\.\)/);
  const report = await readFile("docs/audits/m2-1-evidence-usability/ETN-GEOROC-analysis.md", "utf8");
  assert.match(report, /CC BY-SA 4\.0/);
});

test("supplemental data leaves the reference archive, factors, fixtures, and historical runs unchanged", async () => {
  const [references, fixtures, profile, registry] = await Promise.all([
    readJson("data/processed/reference-sites.json"), readJson("data/processed/candidate-points.json"),
    readJson("data/mission-profiles/mars-surface-v1.json"), readJson("data/evidence/evidence-registry-v1.json")
  ]);
  assert.equal(references.length, 31);
  assert.equal(fixtures.length, 3);
  assert.equal(profile.dimensions.reduce((sum: number, dimension: any) => sum + dimension.factors.length, 0), 19);
  assert.equal(registry.records.length, 31 * 19);
  assert.equal(registry.supplementalRecords.length, 199);
  assert.ok(registry.supplementalRecords.filter((row: any) => row.sourceId === "usgs-publications").every((row: any) => row.factorId === null && row.recordContext.measurementCount === null && row.recordContext.reportedValueCount === 180));
  assert.ok(registry.supplementalRecords.filter((row: any) => row.sourceId === "georoc").every((row: any) => row.state === "not_representative" && row.pointComparisonEligible === false));
  for (const [path, expected] of [
    ["data/processed/discovery-runs/ca4250f9-7379-4fc1-af43-d0bd955ed68a.json", "ff9d88ea7ca007de983e535185c8e54ab7f3e9ffae9e4e34788efab0c078c6ab"],
    ["data/processed/comparison-runs/626a4e76-042f-4539-8626-b9fc1a7bfb31.json", "0f63a5c71f83483cdb1d342f21db6652b573da9e9b60a12acbff215828cb7d31"]
  ]) {
    const contents = await readFile(path, "utf8");
    assert.ok(createHash("sha256").update(contents).digest("hex") === expected, `${path} changed`);
  }
  for (const [path, expected] of [
    ["data/evidence/m2/raw/usgs/ofr2024-1062-full.html", "38b3c0cfdd76b73b5bee09f82cf41c5295289c5f6f0fe5afa33f0449ad4d0864"],
    ["data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv", "db1f5f4f41e495e4d0e7fca1751a41a1436212cad0a95f1c1b7081e8d641ab53"],
    ["data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.txt", "4b544159cee60996b0df04cafa15ad4ad0eddab537bdbd9df750bd23de7a1064"]
  ]) {
    const contents = await readFile(path, "utf8");
    assert.ok(createHash("sha256").update(contents).digest("hex") === expected, `${path} changed`);
  }
});
