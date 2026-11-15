import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateMissionProfile, validateBlindBenchmarkProtocol, validateBlindFeaturePayload } from "../src/schemas/mission-profile.js";
import { validateRecords } from "../src/validation/records.js";

const readJson = async (path: string): Promise<any> => JSON.parse(await readFile(path, "utf8"));

describe("M05 mission profiles and blind benchmark planning", () => {
  it("validates version, factor metadata, units, availability, and provenance", async () => {
    const profile = await readJson("data/mission-profiles/mars-surface-v1.json");
    assert.deepEqual(validateMissionProfile(profile), []);
    const badVersion = structuredClone(profile); badVersion.profileVersion = "2.0.0";
    assert.notEqual(validateMissionProfile(badVersion).length, 0);
    const badUnit = structuredClone(profile); badUnit.dimensions[0].factors[0].unit = "";
    assert.notEqual(validateMissionProfile(badUnit).length, 0);
    const badProvenance = structuredClone(profile); badProvenance.dimensions[0].factors[0].evidenceAvailability.sourceUrl = null;
    assert.notEqual(validateMissionProfile(badProvenance).length, 0);
  });

  it("accepts null for missing evidence and rejects inconsistent availability claims", async () => {
    const profile = await readJson("data/mission-profiles/mars-surface-v1.json");
    assert.deepEqual(validateMissionProfile(profile), []);
    const wrong = structuredClone(profile);
    const unavailable = wrong.dimensions[0].factors.find((factor: any) => factor.id === "aridity_water_balance");
    unavailable.evidenceAvailability.availableSiteIds = ["GKC"];
    assert.notEqual(validateMissionProfile(wrong).length, 0);
    const invalidState = structuredClone(profile);
    invalidState.dimensions[0].factors[0].evidenceAvailability.status = "unknown";
    assert.notEqual(validateMissionProfile(invalidState).length, 0);
  });

  it("validates the uncreated split and prevents overlap, fixtures, and non-reference records", async () => {
    const protocol = await readJson("data/benchmarks/blind-benchmark-protocol-v1.json");
    const known = await readJson("data/processed/reference-sites.json");
    const other = await readJson("data/processed/candidate-points.json");
    const discovery = await readJson("data/processed/discovery-runs/latest.json");
    const candidateIds = [...other.filter((record: any) => record.recordType === "candidate_region"), ...discovery.candidates].map((record: any) => record.id);
    const fixtureIds = other.filter((record: any) => record.recordType === "test_fixture").map((record: any) => record.id);
    const knownIds = known.map((record: any) => record.id);
    assert.deepEqual(validateBlindBenchmarkProtocol(protocol, knownIds, candidateIds, fixtureIds), []);
    const invalidSnapshot=structuredClone(protocol);invalidSnapshot.referenceSet.candidateRegionCount=-1;assert.notEqual(validateBlindBenchmarkProtocol(invalidSnapshot,knownIds,candidateIds,fixtureIds).length,0);
    const leaked = structuredClone(protocol);
    leaked.splitProposal.calibrationReferenceIds = ["GKC"];
    leaked.splitProposal.heldOutReferenceIds = ["GKC"];
    assert.notEqual(validateBlindBenchmarkProtocol(leaked, knownIds, candidateIds, fixtureIds).length, 0);
    const fixtureSplit = structuredClone(protocol);
    fixtureSplit.splitProposal.calibrationReferenceIds = ["GRID-TEST-01"];
    assert.notEqual(validateBlindBenchmarkProtocol(fixtureSplit, knownIds, candidateIds, fixtureIds).length, 0);
  });

  it("rejects identifying fields in blind features and verifies record-type separation", async () => {
    assert.deepEqual(validateBlindFeaturePayload({ evaluationKey: "opaque-01", factors: { climate: { temperatureC: null } } }), []);
    assert.notEqual(validateBlindFeaturePayload({ evaluationKey: "opaque-01", factors: { country: "Egypt" } }).length, 0);
    assert.notEqual(validateBlindFeaturePayload({ evaluationKey: "opaque-01", factors: { siteName: "Example" } }).length, 0);
    assert.notEqual(validateBlindFeaturePayload({ evaluationKey: "opaque-01", factors: { temperature: { score: 0.8 } } }).length, 0);
    const known = await readJson("data/processed/known-sites.json");
    const records = await readJson("data/processed/candidate-points.json");
    assert.deepEqual(validateRecords(known), []);
    assert.deepEqual(validateRecords(records), []);
    assert.equal(known.length, 26);
    assert.equal(records.filter((record: any) => record.recordType === "candidate_region").length, 0);
    assert.equal(records.filter((record: any) => record.recordType === "test_fixture").length, 3);
    const profile = await readJson("data/mission-profiles/mars-surface-v1.json");
    const serialized = JSON.stringify(profile);
    assert.equal(/"(?:similarityScore|missionScore|score|ranking|weights?)"\s*:/i.test(serialized), false);
    assert.equal(serialized.includes("climate_mars_score"), false);
  });
});
