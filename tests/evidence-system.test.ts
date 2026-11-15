import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evidenceStateForRetrieval, isTraceableVerifiedClaim, pointComparisonAllowed, selectPointEligibleReferences, type UnifiedEvidenceRecord } from "../src/evidence/unified.js";
import { validateEvidenceRegistry } from "../src/evidence/validate.js";

test("curation eligibility blocks regions and pending reviews from point comparisons", () => {
  assert.equal(pointComparisonAllowed("region_only", false, "region"), false);
  assert.equal(pointComparisonAllowed("exclude_pending_review", false, "approximate_area_marker"), false);
  assert.equal(pointComparisonAllowed("keep_with_limitations", true, "approximate_area_marker"), true);
  assert.equal(pointComparisonAllowed("keep_verified", true, "region"), false);
  const refs = [{ id: "OK", latitude: 1, longitude: 2 }, { id: "NO_POINT", latitude: null, longitude: null }, { id: "PENDING", latitude: 3, longitude: 4 }];
  const policy: any[] = [{ stableId: "OK", preliminaryDecision: "keep_with_limitations", pointComparisonEligible: true, locationType: "point" }, { stableId: "NO_POINT", preliminaryDecision: "keep_with_limitations", pointComparisonEligible: true, locationType: "region" }, { stableId: "PENDING", preliminaryDecision: "exclude_pending_review", pointComparisonEligible: false, locationType: "point" }];
  assert.deepEqual(selectPointEligibleReferences(refs, policy).map((record) => record.id), ["OK"]);
});

test("source result states stay distinct and evidence quality does not follow record count", () => {
  assert.equal(evidenceStateForRetrieval("success"), "available");
  assert.equal(evidenceStateForRetrieval("no_match"), "no_matching_records");
  assert.equal(evidenceStateForRetrieval("failed"), "retrieval_failed");
  assert.equal(evidenceStateForRetrieval("not_attempted"), "not_retrieved");
  assert.equal(evidenceStateForRetrieval("no_data_class"), "source_no_data_class");
  assert.equal(evidenceStateForRetrieval("ambiguous"), "ambiguous");
  const claim: UnifiedEvidenceRecord = { evidenceId: "X:f:v1", siteId: "X", dimension: "Climate", factorId: "f", basis: "atlas_claim", state: "available", sourceId: "atlas", sourceUrl: null, datasetId: "atlas", originalRecordId: null, retrievedAt: null, observationPeriod: null, latitude: null, longitude: null, spatialRelationship: "unknown", parameter: "f", value: null, unit: null, rawRecordReference: null, normalizedRecordReference: "legacy", qualityLimitations: ["Not independently verified"] };
  assert.equal(isTraceableVerifiedClaim(claim), false);
  assert.equal(isTraceableVerifiedClaim({ ...claim, basis: "conflicting", state: "available", sourceId: "source", sourceUrl: "https://example.org" }), false);
  assert.equal(evidenceStateForRetrieval("unavailable"), "unavailable");
});

test("registry validation preserves all references, fixture separation, and null missing values", () => {
  const sites = Array.from({ length: 31 }, (_, i) => `R${i}`);
  const curation = sites.map((stableId) => ({ stableId, preliminaryDecision: "keep_with_limitations", pointComparisonEligible: true }));
  const registry = { schemaVersion: "1.0.0", evidenceModelVersion: "1.0.0", records: sites.map((siteId) => ({ evidenceId: `${siteId}:f:v1`, siteId, factorId: "f", basis: "unverified", state: "not_retrieved", value: null, qualityLimitations: [], pointComparisonEligible: true })) };
  assert.deepEqual(validateEvidenceRegistry(registry, sites, ["FIXTURE"], curation), []);
  const invalid: any = structuredClone(registry); invalid.records[0].value = 0;
  assert.ok(validateEvidenceRegistry(invalid, sites, ["FIXTURE"], curation).some((message) => /non-available/.test(message)));
  const leakage = structuredClone(registry); leakage.records[0].siteId = "FIXTURE";
  assert.ok(validateEvidenceRegistry(leakage, sites, ["FIXTURE"], curation).some((message) => /fixture/.test(message)));
});

test("supplemental source measurements require provenance and cannot enter point comparisons", () => {
  const sites = Array.from({ length: 31 }, (_, i) => `R${i}`);
  const curation = sites.map((stableId) => ({ stableId, preliminaryDecision: "keep_with_limitations", pointComparisonEligible: true }));
  const registry: any = { schemaVersion: "1.0.0", evidenceModelVersion: "1.0.0", records: sites.map((siteId) => ({ evidenceId: `${siteId}:f:v1`, siteId, factorId: "f", basis: "unverified", state: "not_retrieved", value: null, qualityLimitations: [], pointComparisonEligible: true })), supplementalRecordCount: 1, supplementalRecords: [{ evidenceId: "M2:R0:sample-1", siteId: "R0", factorId: "f", basis: "primary_dataset", state: "not_representative", sourceId: "source", sourceUrl: "https://example.org/data", originalRecordId: "sample-1", retrievedAt: "2026-01-01T00:00:00Z", rawRecordReference: "data/raw/source.csv", normalizedRecordReference: "data/evidence/normalized.json", value: 0, spatialRelationship: "regional_context", pointComparisonEligible: false, recordContext: { sourceRecordCount: 1, sampleCount: 1, sampleCountBasis: "one", measurementCount: 1, measurementCountBasis: "one", reportedValueCount: 1, reportedValueCountBasis: "one", distinctLocationCount: null, distinctLocationBasis: "unknown", analyticalContext: "one regional value", measurementInterpretation: "individual_analysis" } }] };
  assert.deepEqual(validateEvidenceRegistry(registry, sites, ["FIXTURE"], curation), []);
  registry.supplementalRecords[0].pointComparisonEligible = true;
  assert.ok(validateEvidenceRegistry(registry, sites, ["FIXTURE"], curation).some((message) => /point comparison/.test(message)));
  registry.supplementalRecords[0].pointComparisonEligible = false;
  registry.supplementalRecords[0].rawRecordReference = null;
  assert.ok(validateEvidenceRegistry(registry, sites, ["FIXTURE"], curation).some((message) => /traceable provenance/.test(message)));
});

test("reference evidence UI labels and explanations are English-only", async () => {
  const ui = await readFile("web/src/App.tsx", "utf8");
  assert.equal(/[\u0600-\u06ff]/u.test(ui), false);
  assert.match(ui, /UNIFIED FACTOR EVIDENCE/);
  assert.match(ui, /Not eligible for point comparison/);
  assert.match(ui, /not independently verified/);
  assert.match(ui, /15 distinct particles represented by mounts/);
  assert.match(ui, /195 table entries are not 195 independent samples/);
  assert.match(ui, /not four samples or four locations/);
  assert.match(ui, /CC BY-SA 4\.0/);
});
