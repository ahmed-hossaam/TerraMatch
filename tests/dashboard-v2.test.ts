import test from "node:test";
import assert from "node:assert/strict";
import { dashboardCandidateRecords, dashboardComparisonForDiscovery, dashboardTargetAvailability, workspaceRecordHref } from "../web/src/dashboard-v2-model.js";
import { unsupportedRequiredFactors } from "../src/discovery/supported-factors.js";

test("Dashboard V2 maps only actual candidate records with finite coordinates", () => {
  const records = dashboardCandidateRecords([
    { id: "candidate-real", recordType: "candidate_region", latitude: -24.5, longitude: -69.2, status: "evidence_supported_for_review" },
    { id: "insufficient", recordType: "candidate_region", latitude: -24.4, longitude: -69.2, status: "insufficient_evidence" },
    { id: "overlap", recordType: "candidate_region", latitude: -24.3, longitude: -69.2, status: "rejected_reference_overlap" },
    { id: "reference", recordType: "reference_site", latitude: -24, longitude: -69 },
    { id: "missing-coordinate", recordType: "candidate_region", latitude: Number.NaN, longitude: -69 },
  ], "Atacama bounded search");

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: "candidate-real",
    name: "Atacama bounded search",
    kind: "candidate_region",
    latitude: -24.5,
    longitude: -69.2,
    approximate: true,
    detail: "evidence_supported_for_review",
    status: "evidence_supported_for_review",
    cellBounds: null,
  });
});

test("Dashboard V2 reports Mars bounded availability and keeps Moon discovery unavailable", () => {
  assert.equal(dashboardTargetAvailability("mars").available, true);
  const moon = dashboardTargetAvailability("moon");
  assert.equal(moon.available, false);
  assert.match(moon.message, /no validated lunar target study area/i);
});

test("only mission profiles with every required factor in the current pipeline are runnable", () => {
  assert.deepEqual(unsupportedRequiredFactors(["air_temperature_daily_mean", "mapped_lithology"]), []);
  assert.deepEqual(unsupportedRequiredFactors(["mapped_lithology", "mineral_evidence"]), ["mineral_evidence"]);
});

test("Dashboard V2 only associates a reference matrix with its recorded discovery run", () => {
  const comparisons = [
    { runId: "comparison-a", discoveryRunId: "discovery-a" },
    { runId: "comparison-b", discoveryRunId: "discovery-b" },
  ];
  assert.equal(dashboardComparisonForDiscovery(comparisons, "discovery-b"), "comparison-b");
  assert.equal(dashboardComparisonForDiscovery(comparisons, "discovery-missing"), null);
});

test("Dashboard V2 Explore opens candidate details in the matching V2 run context", () => {
  assert.equal(workspaceRecordHref("candidate_region", "candidate / one", "run-123"), "/dashboard/candidate/candidate%20%2F%20one?run=run-123");
  assert.equal(workspaceRecordHref("known_analog", "GKC", "run-123"), "/references/GKC");
  assert.equal(workspaceRecordHref("candidate_region", "candidate-one", null), "/dashboard/candidate/candidate-one");
});
