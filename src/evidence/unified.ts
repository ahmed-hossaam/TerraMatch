export type EvidenceBasis = "primary_dataset" | "peer_reviewed_source" | "official_documentation" | "atlas_claim" | "derived_value" | "unverified" | "conflicting";
export type EvidenceState = "available" | "not_retrieved" | "no_matching_records" | "retrieval_failed" | "unavailable" | "not_representative" | "insufficient_provenance" | "source_no_data_class" | "ambiguous" | "missing";
export type CurationDecision = "keep_verified" | "keep_with_limitations" | "region_only" | "exclude_pending_review";
export interface UnifiedEvidenceRecord {
  evidenceId: string; siteId: string; dimension: string; factorId: string | null; basis: EvidenceBasis; state: EvidenceState;
  sourceId: string | null; sourceUrl: string | null; datasetId: string | null; originalRecordId: string | null;
  retrievedAt: string | null; observationPeriod: string | null; latitude: number | null; longitude: number | null;
  spatialRelationship: "site_marker" | "point_sample" | "regional" | "regional_context" | "unknown"; parameter: string | null; value: unknown; unit: string | null;
  rawRecordReference: string | null; normalizedRecordReference: string | null; qualityLimitations: string[];
  curationDecision?: CurationDecision; pointComparisonEligible?: boolean;
}

export function pointComparisonAllowed(decision: CurationDecision, pointComparisonEligible: boolean, locationType: string): boolean {
  return pointComparisonEligible && (decision === "keep_verified" || decision === "keep_with_limitations") && locationType !== "region" && locationType !== "regional_area";
}

export function selectPointEligibleReferences<T extends { id: string; latitude: number | null; longitude: number | null }>(references: T[], curationRecords: Array<{ stableId: string; preliminaryDecision: CurationDecision; pointComparisonEligible: boolean; locationType: string }>): T[] {
  const policies = new Map(curationRecords.map((record) => [record.stableId, record]));
  return references.filter((record) => {
    const policy = policies.get(record.id);
    return !!policy && Number.isFinite(record.latitude) && Number.isFinite(record.longitude) && pointComparisonAllowed(policy.preliminaryDecision, policy.pointComparisonEligible, policy.locationType);
  });
}

export function evidenceStateForRetrieval(status: string | null | undefined): EvidenceState {
  if (status === "success" || status === "retrieved") return "available";
  if (status === "no_match" || status === "no_matching_records") return "no_matching_records";
  if (status === "failed" || status === "retrieval_failed") return "retrieval_failed";
  if (status === "unavailable") return "unavailable";
  if (status === "not_representative") return "not_representative";
  if (status === "insufficient_provenance") return "insufficient_provenance";
  if (status === "source_no_data_class" || status === "no_data_class") return "source_no_data_class";
  if (status === "ambiguous") return "ambiguous";
  return "not_retrieved";
}

export function isTraceableVerifiedClaim(record: UnifiedEvidenceRecord): boolean {
  return record.basis !== "unverified" && record.basis !== "conflicting" && !!record.sourceUrl && !!record.sourceId && (record.state === "available" || record.state === "not_representative");
}
