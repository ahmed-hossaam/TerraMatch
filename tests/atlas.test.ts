import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeAtlasSite } from "../src/normalization/atlas.js";
import { candidateFixtures } from "../src/normalization/fixtures.js";
import { validateRecords } from "../src/validation/records.js";

const source = JSON.parse(await readFile("أطلس المواقع المشابهة للمريخ (JSON).json", "utf8"));
describe("Milestone 1 atlas foundation", () => {
  it("parses all 26 source sites", () => { assert.equal(source.sites.length, 26); });
  it("preserves original climate-only score without recasting it", () => {
    const record = normalizeAtlasSite(source.sites[0]);
    assert.equal(record.atlas?.climateMarsScore, source.sites[0].climate_mars_score);
    assert.match(record.atlas?.climateMarsScoreNote ?? "", /climate-only/i);
  });
  it("validates normalized known records and all candidate fixtures", () => {
    assert.deepEqual(validateRecords([...source.sites.map(normalizeAtlasSite), ...candidateFixtures]), []);
    assert.deepEqual(candidateFixtures.map(x => x.recordType), ["test_fixture", "test_fixture", "test_fixture"]);
  });
  it("detects duplicate IDs and bad coordinates", () => {
    const record = normalizeAtlasSite(source.sites[0]);
    assert.equal(validateRecords([record, { ...record }]).some(e => e.message === "Duplicate ID"), true);
    assert.equal(validateRecords([{ ...record, latitude: 91 }]).some(e => e.message.includes("Latitude")), true);
  });
  it("keeps absent values null and separates rock description from mineral claims", () => {
    const record = normalizeAtlasSite({ ...source.sites[0], climate_nasa_power: {}, geology: { rocks: "Basalt", minerals: [] } });
    assert.equal(record.climate.meanTemperatureC.value, null);
    assert.equal(record.geology.lithology.classification, null);
    assert.equal(record.geology.rockDescription, "Basalt");
    assert.deepEqual(record.geology.minerals, []);
  });
  it("does not relabel legacy atlas mineral descriptions as verified", () => {
    assert.equal(normalizeAtlasSite(source.sites[0]).geology.minerals.every(m => m.verified === false), true);
  });
});
