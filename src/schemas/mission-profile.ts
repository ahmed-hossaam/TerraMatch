import type { BlindBenchmarkProtocol, BlindFeaturePayload, EvidenceAvailability, EvidenceKind, MissionProfile } from "../types/mission-profile.js";

const allowedAvailability = new Set<EvidenceAvailability>(["retrieved_subset", "derived_subset", "legacy_only", "research_context_only", "not_available"]);
const allowedEvidenceKind = new Set<EvidenceKind>(["provider_gridded", "provider_raster_sample", "mapped_lithology", "derived_from_provider_data", "atlas_description", "research_context", "missing"]);
const forbiddenOutputKey = /(^|_)(score|scores|rank|ranking|weight|weights|similarity)(_|$)/i;
const requiredLeakageFields = ["site name", "country", "region name", "atlas label", "analog type", "Mars counterpart", "legacy climate_mars_score", "reference citations", "test-fixture id"];

function isObject(value: unknown): value is Record<string, any> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function uniqueStrings(value: unknown): value is string[] { return Array.isArray(value) && value.every(nonEmptyString) && new Set(value).size === value.length; }
function checkForbiddenKeys(value: unknown, path: string, errors: string[]) {
  if (Array.isArray(value)) { value.forEach((entry, index) => checkForbiddenKeys(entry, `${path}[${index}]`, errors)); return; }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenOutputKey.test(key)) errors.push(`${path}.${key} is prohibited in a requirements/protocol artifact`);
    checkForbiddenKeys(child, `${path}.${key}`, errors);
  }
}

export function validateMissionProfile(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["profile must be an object"];
  if (value.schemaVersion !== "1.0.0" || value.profileVersion !== "1.0.0") errors.push("schemaVersion and profileVersion must both be 1.0.0");
  if (!nonEmptyString(value.profileId)) errors.push("profileId is required");
  if (value.targetPlanet !== "Mars" || value.targetEnvironment !== "surface") errors.push("profile must target Mars surface environments");
  if (value.status !== "requirements_only") errors.push("profile status must be requirements_only");
  if (!nonEmptyString(value.purpose)) errors.push("purpose is required");
  if (!Array.isArray(value.scientificCautions) || !value.scientificCautions.every(nonEmptyString)) errors.push("scientificCautions must be non-empty strings");
  if (!Array.isArray(value.dimensions) || value.dimensions.length === 0) errors.push("at least one dimension is required");
  if (!Array.isArray(value.missions) || value.missions.length === 0) errors.push("at least one mission profile is required");

  const factorIds = new Set<string>();
  const dimensionIds = new Set<string>();
  for (const [dimensionIndex, dimension] of (Array.isArray(value.dimensions) ? value.dimensions : []).entries()) {
    const path = `dimensions[${dimensionIndex}]`;
    if (!isObject(dimension)) { errors.push(`${path} must be an object`); continue; }
    if (!nonEmptyString(dimension.id) || dimensionIds.has(dimension.id)) errors.push(`${path}.id must be a unique non-empty string`);
    else dimensionIds.add(dimension.id);
    if (!nonEmptyString(dimension.name) || !nonEmptyString(dimension.whyItMatters)) errors.push(`${path} requires a name and scientific rationale`);
    if (!Array.isArray(dimension.factors) || dimension.factors.length === 0) { errors.push(`${path}.factors must not be empty`); continue; }
    for (const [factorIndex, factor] of dimension.factors.entries()) {
      const fpath = `${path}.factors[${factorIndex}]`;
      if (!isObject(factor)) { errors.push(`${fpath} must be an object`); continue; }
      if (!nonEmptyString(factor.id) || factorIds.has(factor.id)) errors.push(`${fpath}.id must be globally unique`);
      else factorIds.add(factor.id);
      if (!nonEmptyString(factor.name) || !nonEmptyString(factor.definition) || !nonEmptyString(factor.unit)) errors.push(`${fpath} requires a name, definition, and unit or categorical-unit description`);
      if (!["required", "optional", "currently_unavailable"].includes(factor.requirementStatus)) errors.push(`${fpath}.requirementStatus is invalid`);
      if (!Array.isArray(factor.limitations) || !factor.limitations.every(nonEmptyString)) errors.push(`${fpath}.limitations must be an array of non-empty strings`);
      if (factor.nextEvidenceNeed !== null && !nonEmptyString(factor.nextEvidenceNeed)) errors.push(`${fpath}.nextEvidenceNeed must be a string or null`);
      const availability = factor.evidenceAvailability;
      if (!isObject(availability)) { errors.push(`${fpath}.evidenceAvailability is required`); continue; }
      if (!allowedAvailability.has(availability.status)) errors.push(`${fpath}.evidenceAvailability.status is invalid`);
      if (!allowedEvidenceKind.has(availability.evidenceKind)) errors.push(`${fpath}.evidenceAvailability.evidenceKind is invalid`);
      if (!uniqueStrings(availability.availableSiteIds)) errors.push(`${fpath}.availableSiteIds must contain unique string IDs`);
      const hasSource = [availability.sourceId, availability.provider, availability.dataset, availability.sourceUrl, availability.localDataPath].some(nonEmptyString);
      if (["retrieved_subset", "derived_subset"].includes(availability.status)) {
        if (![availability.sourceId, availability.provider, availability.dataset, availability.sourceUrl, availability.localDataPath, availability.spatialResolution, availability.temporalResolution, availability.processingMethod].every(nonEmptyString)) errors.push(`${fpath} available evidence requires complete provenance and resolution fields`);
        if (availability.availableSiteIds.length === 0) errors.push(`${fpath} available evidence needs site IDs`);
        if (availability.status === "retrieved_subset" && availability.evidenceKind === "missing") errors.push(`${fpath} retrieved evidence cannot be marked missing`);
        if (availability.status === "derived_subset" && availability.evidenceKind !== "derived_from_provider_data") errors.push(`${fpath} derived evidence must be identified as derived`);
      } else if (availability.status === "not_available") {
        if (hasSource || availability.availableSiteIds.length !== 0) errors.push(`${fpath} unavailable evidence must not claim a source result or available sites`);
        if (availability.evidenceKind !== "missing") errors.push(`${fpath} unavailable evidence must use evidenceKind missing`);
      } else {
        if (!nonEmptyString(availability.sourceId) || !nonEmptyString(availability.dataset) || availability.availableSiteIds.length !== 0) errors.push(`${fpath} descriptive/context evidence needs provenance and must not claim measured site coverage`);
        if (availability.status === "legacy_only" && availability.evidenceKind !== "atlas_description") errors.push(`${fpath} legacy-only evidence must be an atlas description`);
        if (availability.status === "research_context_only" && availability.evidenceKind !== "research_context") errors.push(`${fpath} research-only evidence must be research context`);
      }
      for (const property of ["observationPeriod", "spatialResolution", "temporalResolution"]) if (availability[property] !== null && !nonEmptyString(availability[property])) errors.push(`${fpath}.${property} must be a string or null`);
    }
  }
  const missionIds = new Set<string>();
  for (const [missionIndex, mission] of (Array.isArray(value.missions) ? value.missions : []).entries()) {
    const path = `missions[${missionIndex}]`;
    if (!isObject(mission)) { errors.push(`${path} must be an object`); continue; }
    if (!nonEmptyString(mission.id) || missionIds.has(mission.id)) errors.push(`${path}.id must be unique`); else missionIds.add(mission.id);
    if (!nonEmptyString(mission.name) || !nonEmptyString(mission.objective)) errors.push(`${path} requires a name and objective`);
    for (const key of ["requiredFactorIds", "optionalFactorIds"]) {
      if (!uniqueStrings(mission[key])) errors.push(`${path}.${key} must contain unique factor IDs`);
      else for (const id of mission[key]) if (!factorIds.has(id)) errors.push(`${path}.${key} references unknown factor ${id}`);
    }
    if (Array.isArray(mission.requiredFactorIds) && Array.isArray(mission.optionalFactorIds) && mission.requiredFactorIds.some((id: string) => mission.optionalFactorIds.includes(id))) errors.push(`${path} cannot require and optionally list the same factor`);
    if (!["partial_evidence", "insufficient_evidence"].includes(mission.currentEvidenceState)) errors.push(`${path}.currentEvidenceState is invalid`);
    if (!Array.isArray(mission.limitations) || !mission.limitations.every(nonEmptyString) || !Array.isArray(mission.nonGoals) || !mission.nonGoals.every(nonEmptyString)) errors.push(`${path} limitations and nonGoals must be string arrays`);
  }
  checkForbiddenKeys(value, "profile", errors);
  return errors;
}

export function validateBlindBenchmarkProtocol(value: unknown, knownIds: string[], candidateIds: string[], fixtureIds: string[]): string[] {
  const errors: string[] = [];
  if (!isObject(value)) return ["protocol must be an object"];
  if (value.schemaVersion !== "1.0.0" || value.protocolVersion !== "1.0.0") errors.push("protocol schema and version must be 1.0.0");
  if (value.status !== "planning_only" || value.scientificValidationStatus !== "not_validated") errors.push("benchmark must remain planning-only and not validated");
  const split = value.splitProposal;
  if (!isObject(split) || split.status !== "not_created_insufficient_independent_data") errors.push("no split may be claimed until independent data supports it");
  else {
    const calibration = split.calibrationReferenceIds;
    const holdout = split.heldOutReferenceIds;
    if (!uniqueStrings(calibration) || !uniqueStrings(holdout)) errors.push("calibration and holdout IDs must be unique string arrays");
    else {
      const overlap = calibration.filter((id: string) => holdout.includes(id));
      if (overlap.length) errors.push(`calibration/holdout overlap: ${overlap.join(", ")}`);
      const invalid = [...calibration, ...holdout].filter((id: string) => !knownIds.includes(id) || candidateIds.includes(id) || fixtureIds.includes(id));
      if (invalid.length) errors.push(`split contains non-reference or fixture IDs: ${invalid.join(", ")}`);
      if (calibration.length || holdout.length) errors.push("a split cannot be populated while status says no split was created");
    }
    if (!nonEmptyString(split.reason) || !nonEmptyString(split.groupingRule) || !Array.isArray(split.minimumAdditionalEvidence) || !split.minimumAdditionalEvidence.every(nonEmptyString)) errors.push("split proposal needs its rationale, grouping rule, and additional evidence requirements");
  }
  if (!isObject(value.referenceSet)) errors.push("referenceSet is required");
  else {
    if (value.referenceSet.knownReferenceCount !== knownIds.length) errors.push("known reference count does not match known-site data");
    if (value.referenceSet.currentRetrievedCount !== value.referenceSet.currentlyRetrievedSiteIds?.length) errors.push("retrieved-site count does not match retrieved site IDs");
    if (!Array.isArray(value.referenceSet.currentlyRetrievedSiteIds) || value.referenceSet.currentlyRetrievedSiteIds.some((id: string) => !knownIds.includes(id))) errors.push("retrieved reference IDs must be known atlas sites");
    if (!Number.isSafeInteger(value.referenceSet.candidateRegionCount) || value.referenceSet.candidateRegionCount < 0) errors.push("candidateRegionCount must be a non-negative integer snapshot");
    if (!uniqueStrings(value.referenceSet.testFixtureIds) || JSON.stringify([...value.referenceSet.testFixtureIds].sort()) !== JSON.stringify([...fixtureIds].sort())) errors.push("test fixture IDs must exactly match fixture records");
  }
  if (!isObject(value.leakageControls)) errors.push("leakageControls is required");
  else {
    if (!Array.isArray(value.leakageControls.featureInputMustExclude) || requiredLeakageFields.some(field => !value.leakageControls.featureInputMustExclude.includes(field))) errors.push("feature input leakage exclusions are incomplete");
    for (const key of ["labelStoreLocation", "retrievalCoordinateHandling", "roleSeparation", "fixtureHandling"]) if (!nonEmptyString(value.leakageControls[key])) errors.push(`leakageControls.${key} is required`);
  }
  if (!isObject(value.outcomeDefinitions)) errors.push("outcomeDefinitions is required");
  else for (const key of ["validMatch", "partialMatch", "unsupported", "missingEvidenceRule"]) if (!nonEmptyString(value.outcomeDefinitions[key])) errors.push(`outcomeDefinitions.${key} is required`);
  if (!isObject(value.evaluationPlan) || value.evaluationPlan.executionStatus !== "not_run" || !Array.isArray(value.evaluationPlan.evidenceRequiredPerResult) || !Array.isArray(value.evaluationPlan.futureReporting)) errors.push("evaluationPlan must describe a not-run protocol");
  checkForbiddenKeys(value, "protocol", errors);
  return errors;
}

const forbiddenBlindKey = /(site|location|country|region|label|atlas|reference|counterpart|coordinate|latitude|longitude|score|rank|weight|name|citation|fixture)/i;
export function validateBlindFeaturePayload(value: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(value) || Object.keys(value).sort().join(",") !== "evaluationKey,factors" || !nonEmptyString(value.evaluationKey) || !isObject(value.factors)) return ["blind feature payload must contain only a non-empty evaluationKey and a factors object"];
  const visit = (item: unknown, path: string) => {
    if (Array.isArray(item)) { item.forEach((entry, index) => visit(entry, `${path}[${index}]`)); return; }
    if (!isObject(item)) return;
    for (const [key, child] of Object.entries(item)) {
      if (forbiddenBlindKey.test(key.replace(/[^a-z]/gi, "")) || /climateMarsScore/i.test(key)) errors.push(`${path}.${key} leaks a reference label or protected location field`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(value.factors, "factors");
  return errors;
}

export function assertMissionProfile(value: unknown): asserts value is MissionProfile { const errors = validateMissionProfile(value); if (errors.length) throw new Error(errors.join("; ")); }
export function assertBenchmarkProtocol(value: unknown, knownIds: string[], candidateIds: string[], fixtureIds: string[]): asserts value is BlindBenchmarkProtocol { const errors = validateBlindBenchmarkProtocol(value, knownIds, candidateIds, fixtureIds); if (errors.length) throw new Error(errors.join("; ")); }
export function assertBlindFeaturePayload(value: unknown): asserts value is BlindFeaturePayload { const errors = validateBlindFeaturePayload(value); if (errors.length) throw new Error(errors.join("; ")); }
