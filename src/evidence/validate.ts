import type { UnifiedEvidenceRecord } from "./unified.js";
const decisions = ["keep_verified", "keep_with_limitations", "region_only", "exclude_pending_review"];
const bases = ["primary_dataset", "peer_reviewed_source", "official_documentation", "atlas_claim", "derived_value", "unverified", "conflicting"];
const states = ["available", "not_retrieved", "no_matching_records", "retrieval_failed", "unavailable", "not_representative", "insufficient_provenance", "source_no_data_class", "ambiguous", "missing"];
export function validateEvidenceRegistry(value: unknown, referenceIds: string[], fixtureIds: string[], curationRecords: any[]): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["evidence registry must be an object"];
  const registry = value as any;
  if (registry.schemaVersion !== "1.0.0" || registry.evidenceModelVersion !== "1.0.0" || !Array.isArray(registry.records)) return ["evidence registry version or records are invalid"];
  const expected = new Set(referenceIds), observed = new Set<string>(), curation = new Map(curationRecords.map((r: any) => [r.stableId, r]));
  const evidenceIds = new Set<string>(), siteFactors = new Set<string>();
  if (referenceIds.length !== 31 || new Set(referenceIds).size !== referenceIds.length) errors.push("authoritative reference input must contain 31 unique stable IDs");
  const fixtureSet = new Set(fixtureIds);
  for (const id of fixtureSet) if (expected.has(id)) errors.push(`fixture ID ${id} leaked into reference inventory`);
  for (const row of registry.records as UnifiedEvidenceRecord[]) {
    const factorKey = `${row.siteId}/${row.factorId}`;
    if (evidenceIds.has(row.evidenceId)) errors.push(`duplicate evidence ID ${row.evidenceId}`);
    if (siteFactors.has(factorKey)) errors.push(`duplicate factor state ${factorKey}`);
    evidenceIds.add(row.evidenceId); siteFactors.add(factorKey);
    if (!expected.has(row.siteId)) errors.push(`evidence site ${row.siteId} is not an authoritative reference`);
    if (fixtureSet.has(row.siteId)) errors.push(`fixture ${row.siteId} leaked into evidence`);
    observed.add(row.siteId);
    if (!row.evidenceId || !row.factorId || !bases.includes(row.basis) || !states.includes(row.state)) errors.push(`evidence record ${row.evidenceId} has invalid identity/basis/state`);
    if (row.state === "available" && row.basis === "primary_dataset" && (!row.sourceId || !row.sourceUrl || !row.rawRecordReference || !row.normalizedRecordReference)) errors.push(`${row.evidenceId} lacks raw/normalized primary dataset provenance`);
    if (!["available", "not_representative", "source_no_data_class", "ambiguous"].includes(row.state) && row.value !== null) errors.push(`${row.evidenceId} assigns a value to non-available evidence`);
    if ((row.basis === "conflicting") && !row.qualityLimitations?.length) errors.push(`${row.evidenceId} conflict has no limitation explanation`);
    const decision: any = curation.get(row.siteId);
    if (!decision) errors.push(`curation decision is missing for ${row.siteId}`);
    else if (decision.pointComparisonEligible !== true && row.pointComparisonEligible === true) errors.push(`${row.siteId} was silently made point-comparison eligible`);
    if (row.pointComparisonEligible === true && !decisions.slice(0, 2).includes(decision?.preliminaryDecision)) errors.push(`${row.siteId} disposition is incompatible with point eligibility`);
  }
  for (const id of expected) if (!observed.has(id)) errors.push(`reference ${id} has no evidence/status records`);
  const supplemental = Array.isArray(registry.supplementalRecords) ? registry.supplementalRecords as UnifiedEvidenceRecord[] : [];
  if ((registry.supplementalRecordCount ?? 0) !== supplemental.length) errors.push("supplemental evidence count does not match its records");
  const supplementalIds = new Set<string>();
  for (const row of supplemental) {
    if (!row.evidenceId || supplementalIds.has(row.evidenceId)) errors.push(`supplemental evidence has a missing or duplicate ID: ${row.evidenceId ?? "(missing)"}`);
    supplementalIds.add(row.evidenceId);
    if (!expected.has(row.siteId) || fixtureSet.has(row.siteId)) errors.push(`supplemental evidence site ${row.siteId} is not a real reference`);
    if (!bases.includes(row.basis) || !states.includes(row.state)) errors.push(`supplemental evidence ${row.evidenceId} has an invalid basis or state`);
    if (!row.sourceId || !row.sourceUrl || !row.rawRecordReference || !row.normalizedRecordReference || !row.retrievedAt || !row.originalRecordId) errors.push(`supplemental evidence ${row.evidenceId} lacks traceable provenance`);
    if (row.value === null || (typeof row.value === "number" && !Number.isFinite(row.value))) errors.push(`supplemental measurement ${row.evidenceId} has a missing or invalid value`);
    if (row.pointComparisonEligible === true) errors.push(`supplemental record ${row.evidenceId} was incorrectly made eligible for point comparison`);
    if (row.state === "not_representative" && !String((row as any).spatialRelationship).includes("regional")) errors.push(`non-representative supplemental record ${row.evidenceId} lacks a regional spatial limitation`);
    const context = (row as any).recordContext;
    if (!context || !Number.isInteger(context.sourceRecordCount) || context.sourceRecordCount < 1 || !context.analyticalContext || !context.measurementInterpretation || !context.sampleCountBasis || !context.measurementCountBasis || !context.reportedValueCountBasis || !context.distinctLocationBasis) errors.push(`supplemental record ${row.evidenceId} lacks explicit record/sample/measurement/location context`);
    if (context && (context.sampleCount !== null && (!Number.isInteger(context.sampleCount) || context.sampleCount < 1) || context.measurementCount !== null && (!Number.isInteger(context.measurementCount) || context.measurementCount < 1) || context.reportedValueCount !== null && (!Number.isInteger(context.reportedValueCount) || context.reportedValueCount < 1) || context.distinctLocationCount !== null && (!Number.isInteger(context.distinctLocationCount) || context.distinctLocationCount < 1))) errors.push(`supplemental record ${row.evidenceId} has invalid acquisition-context counts`);
    if (row.sourceId === "usgs-publications" && (row.siteId !== "MET" || row.latitude !== null || row.longitude !== null || row.factorId !== null || context?.sourceRecordCount !== 195 || context?.sampleCount !== 15 || context?.measurementCount !== null || context?.reportedValueCount !== 180 || context?.distinctLocationCount !== 4 || context?.distinctLocationUnit !== "drill_hole_contexts")) errors.push(`USGS Meteor Crater record ${row.evidenceId} has invalid mount-average scope or point/factor association`);
    if (row.sourceId === "georoc" && (row.siteId !== "ETN" || row.latitude !== null || row.longitude !== null || row.spatialRelationship !== "regional_context" || row.state !== "not_representative" || row.pointComparisonEligible || context?.sourceRecordCount !== 4 || context?.sampleCount !== 1 || context?.measurementCount !== 4 || context?.reportedValueCount !== 4 || context?.distinctLocationCount !== null)) errors.push(`GEOROC Etna record ${row.evidenceId} was incorrectly scoped as a point/site-specific result`);
  }
  const usgsRows = supplemental.filter((row) => row.sourceId === "usgs-publications") as any[];
  const invalidUsGsRows = usgsRows.some((row) => {
    const incorrectInterpretation = row.parameter === "Total"
      ? row.basis !== "derived_value" || row.recordContext.measurementInterpretation !== "reported_analytical_total"
      : row.recordContext.measurementInterpretation !== "reported_average";
    return row.factorId !== null || row.latitude !== null || row.longitude !== null || row.pointComparisonEligible || row.recordContext?.sampleCount !== 15 || row.recordContext?.measurementCount !== null || row.recordContext?.reportedValueCount !== 180 || row.recordContext?.distinctLocationCount !== 4 || incorrectInterpretation;
  });
  if (usgsRows.length && (usgsRows.length !== 195 || invalidUsGsRows)) errors.push("USGS report rows must remain 15 mount-average particles, 180 oxide averages and 15 reported totals without point-factor eligibility");
  const georocRows = supplemental.filter((row) => row.sourceId === "georoc") as any[];
  if (georocRows.length && (georocRows.length !== 4 || new Set(georocRows.map((row) => row.sampleLabel)).size !== 1 || georocRows.some((row) => row.parameter !== "FEOT" || row.unit !== "wt%" || row.recordContext?.sampleCount !== 1 || row.recordContext?.distinctLocationCount !== null || row.state !== "not_representative" || row.pointComparisonEligible))) errors.push("GEOROC rows must remain four analyses for one sample label with regional, non-point status");
  return errors;
}
