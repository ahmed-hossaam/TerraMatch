import test from "node:test";
import assert from "node:assert/strict";
import { coordinateRelationship, parseEarthChemSamples, parseGeorocCsv, parseUsGsMeteorCraterTable1, persistRawCatalogPayload, retrieveEarthChemSamples, retrieveGeorocCsv, retrieveScienceBaseItem } from "../src/data-sources/external-catalogs.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

test("ScienceBase adapter keeps an unavailable service distinct from a successful empty response", async () => {
  const unavailable = await retrieveScienceBaseItem("item", async () => { throw new Error("blocked"); });
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.records, []);
  const item = await retrieveScienceBaseItem("item", async () => new Response(JSON.stringify({ id: "item", title: "PAAD" }), { status: 200 }));
  assert.equal(item.status, "retrieved");
  assert.equal(item.records[0].id, "item");
});

test("EarthChem parser distinguishes valid empty results, malformed data, and samples", () => {
  assert.equal(parseEarthChemSamples({ samples: [] }, "https://example.org").status, "no_match");
  assert.equal(parseEarthChemSamples({ samples: [{ sampleId: "s1", latitude: 1, longitude: 2 }] }, "https://example.org").records.length, 1);
  assert.equal(parseEarthChemSamples({ error: "bad" }, "https://example.org").status, "failed");
});

test("GEOROC CSV parser preserves values and coordinate association is spatial, not name-only", () => {
  const parsed = parseGeorocCsv('Sample,Latitude,Longitude,SiO2 (wt%)\nS1,10,20,48.2', "https://georoc.eu/query");
  assert.equal(parsed.status, "retrieved");
  assert.equal(parsed.records[0]["SiO2 (wt%)"], "48.2");
  assert.equal(coordinateRelationship({ siteId: "X", latitude: 10, longitude: 20 }, parsed.records[0]), "exact");
  assert.equal(coordinateRelationship({ siteId: "X", latitude: null, longitude: null }, parsed.records[0]), "unmatched");
  assert.equal(parseGeorocCsv("not a data table", "https://georoc.eu/query").status, "failed");
});

test("USGS Meteor Crater report parser preserves mount-average values, units, methods, and zero measurements", () => {
  const mounts = ["A", "E", "G", "H", "I", "J", "K", "O", "P", "AC", "AD", "AG", "AL", "AP", "AQ"];
  const headers = `<th>Major-oxide composition</th><th>Mount number</th>${mounts.map((mount) => `<th>${mount}</th>`).join("")}`;
  const parameters = ["SiO<sub>2</sub>", "Al<sub>2</sub>O<sub>3</sub>", "CaO", "MgO", "FeO", "Na<sub>2</sub>O", "P<sub>2</sub>O<sub>5</sub>", "K<sub>2</sub>O", "TiO<sub>2</sub>", "Cr<sub>2</sub>O<sub>3</sub>", "MnO", "NiO", "Total"];
  const rows = parameters.map((parameter, rowIndex) => `<tr><td>${parameter}</td>${mounts.map((_, columnIndex) => `<td>${rowIndex === 0 && columnIndex === 0 ? "0.00" : `${rowIndex + columnIndex + 1}.25`}</td>`).join("")}</tr>`).join("");
  const parsed = parseUsGsMeteorCraterTable1(`<a id="ofr20241062-t01"></a><table><thead>${headers}</thead><tbody>${rows}</tbody></table>`);
  assert.equal(parsed.status, "retrieved");
  assert.equal(parsed.records.length, 195);
  assert.equal(parsed.records[0].originalRecordId, "OFR2024-1062:Table1:mount-A:SiO2");
  assert.equal(parsed.records[0].value, 0);
  assert.equal(parsed.records[0].unit, "wt%");
  assert.equal(parsed.records[0].method, "wavelength dispersive spectrometry (WDS)");
  assert.equal(parsed.records[0].material, "Pristine impact-melt glass; average composition for mount");
  assert.equal(parseUsGsMeteorCraterTable1("<html>no table</html>").status, "failed");
});

test("bounded EarthChem and GEOROC download adapters preserve failure states and avoid large imports", async () => {
  const ec = await retrieveEarthChemSamples("https://example.org/v4/locations/samples", async () => new Response(JSON.stringify({ samples: [{ sampleId: "s1", lat: 12, lon: 34, SiO2: { value: 50, unit: "wt%" } }] }), { status: 200 }));
  assert.equal(ec.status, "retrieved"); assert.equal((ec.records[0].SiO2 as any).unit, "wt%");
  const offline = await retrieveEarthChemSamples("https://example.org", async () => { throw new Error("offline"); });
  assert.equal(offline.status, "unavailable");
  const large = await retrieveGeorocCsv("https://example.org/large.csv", async () => new Response("", { status: 200, headers: { "content-length": "2000" } }), 100);
  assert.equal(large.status, "unavailable");
  const csv = await retrieveGeorocCsv("https://example.org/small.csv", async () => new Response("Sample,Latitude,Longitude,SiO2 (wt%)\nS1,10,20,48.2", { status: 200 }));
  assert.equal(csv.status, "retrieved"); assert.equal(csv.records.length, 1);
});

test("raw catalog payload persistence never overwrites an existing response", async () => {
  const dir = await mkdtemp(`${tmpdir()}/terramatch-m2-`), path = `${dir}/raw.json`;
  try {
    assert.equal(await persistRawCatalogPayload(path, '{"source":"original"}'), "written");
    assert.equal(await persistRawCatalogPayload(path, '{"source":"replacement"}'), "already_present");
    assert.equal(await readFile(path, "utf8"), '{"source":"original"}');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
