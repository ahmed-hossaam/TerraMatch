export type DiscoveryOutcomeCode =
  | "candidates_available_for_review"
  | "candidates_available_with_required_source_failures"
  | "required_source_failed"
  | "completed_with_insufficient_evidence"
  | "no_eligible_candidates";

export interface DiscoveryOutcome {
  code: DiscoveryOutcomeCode;
  eligibleCandidateCount: number;
  reviewableCandidateCount: number;
  insufficientCandidateCount: number;
  excludedCandidateCount: number;
  requiredSourceFailureCount: number;
  sourceFailureCount: number;
  explanation: string;
}

/** Summarize execution evidence without turning schema validity into scientific success. */
export function summarizeDiscoveryOutcome(run: any): DiscoveryOutcome {
  const candidates = (run?.candidates ?? []).filter((candidate: any) => candidate?.recordType === "candidate_region");
  const excludedCandidateCount = candidates.filter((candidate: any) => candidate.status === "rejected_reference_overlap").length;
  const eligible = candidates.filter((candidate: any) => candidate.status !== "rejected_reference_overlap");
  const reviewable = eligible.filter((candidate: any) => candidate.status === "evidence_supported_for_review");
  const insufficient = eligible.filter((candidate: any) => candidate.status === "insufficient_evidence");
  const requiredFailed = eligible.reduce((count: number, candidate: any) => count + (candidate.screening?.requiredFactors ?? []).filter((factor: any) => factor.status === "failed").length, 0);
  const sourceFailures = eligible.reduce((count: number, candidate: any) => count + Object.values(candidate.sources ?? {}).filter((source: any) => source?.status === "failed").length, 0);
  let code: DiscoveryOutcomeCode;
  let explanation: string;
  if (!eligible.length) {
    code = "no_eligible_candidates";
    explanation = "The run completed, but every generated cell was excluded or no candidate cell was generated.";
  } else if (reviewable.length && requiredFailed) {
    code = "candidates_available_with_required_source_failures";
    explanation = "Some candidates have required evidence for review, and at least one required source failed for another candidate.";
  } else if (reviewable.length) {
    code = "candidates_available_for_review";
    explanation = "Some candidates have the selected profile's required evidence available for review; this is not analog confirmation or suitability.";
  } else if (requiredFailed) {
    code = "required_source_failed";
    explanation = "No candidate met the evidence gate because one or more required sources failed.";
  } else {
    code = "completed_with_insufficient_evidence";
    explanation = "The run completed, but no eligible candidate has all required evidence available.";
  }
  return { code, eligibleCandidateCount: eligible.length, reviewableCandidateCount: reviewable.length, insufficientCandidateCount: insufficient.length, excludedCandidateCount, requiredSourceFailureCount: requiredFailed, sourceFailureCount: sourceFailures, explanation };
}
