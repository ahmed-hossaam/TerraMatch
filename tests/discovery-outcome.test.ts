import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDiscoveryOutcome } from "../src/discovery/outcome.js";

const candidate = (status: string, required = "available", source = "success") => ({
  recordType: "candidate_region",
  status,
  screening: { requiredFactors: [{ factorId: "temperature", status: required }] },
  sources: { climate: { status: source } },
});

test("discovery outcome separates supported candidates, insufficient evidence, source failures, and exclusions", () => {
  assert.equal(summarizeDiscoveryOutcome({ candidates: [candidate("evidence_supported_for_review")] }).code, "candidates_available_for_review");
  assert.equal(summarizeDiscoveryOutcome({ candidates: [candidate("insufficient_evidence", "missing")] }).code, "completed_with_insufficient_evidence");
  assert.equal(summarizeDiscoveryOutcome({ candidates: [candidate("insufficient_evidence", "failed", "failed")] }).code, "required_source_failed");
  assert.equal(summarizeDiscoveryOutcome({ candidates: [candidate("rejected_reference_overlap")] }).code, "no_eligible_candidates");
});

test("reviewable candidate outcome still reports optional provider failures separately", () => {
  const result = summarizeDiscoveryOutcome({ candidates: [candidate("evidence_supported_for_review", "available", "failed")] });
  assert.equal(result.code, "candidates_available_for_review");
  assert.equal(result.reviewableCandidateCount, 1);
  assert.equal(result.sourceFailureCount, 1);
  assert.match(result.explanation, /not analog confirmation/i);
});
