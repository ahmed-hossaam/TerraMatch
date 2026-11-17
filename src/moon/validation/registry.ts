import type { CoordinateReference } from "../../destinations/types.js";
import type { CoverageSummary, DerivedProductLineage, MoonDatasetEntry } from "../products/contracts.js";
import { MOON_DATASETS, MOON_REGISTRY_VERSION } from "../registry/dataset-registry.js";

const lifecycleStates = new Set(["not_started", "implemented", "completed", "blocked", "not_applicable"]);
const acquisitionStates = new Set(["not_acquired", "partial_coverage", "acquired", "unavailable", "failed", "unknown"]);
const evidenceClasses = new Set(["in_situ_observation", "remote_sensing_observation", "derived_product", "interpreted_mapping", "modeled_indicator", "research_hypothesis"]);
const metadataStates = new Set(["verified", "partial", "unverified", "unknown"]);
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validCoordinateReference(value: CoordinateReference): boolean {
  return !!value && value.targetBody === "moon" && ["planetocentric", "geodetic", "unknown"].includes(value.latitudeType) && ["positive_east", "positive_west", "unknown"].includes(value.longitudeDirection) && ["-180_180", "0_360", "unknown"].includes(value.longitudeDomain) && ["degrees", "meters", "unknown"].includes(value.coordinateUnits) && typeof value.projection === "string" && (value.referenceRadiusM === null || (Number.isFinite(value.referenceRadiusM) && value.referenceRadiusM > 0));
}
export function validateMoonDatasetRegistry(value: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value)) return ["Moon dataset registry must be an array."];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const path = `datasets[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push(`${path} must be an object.`); continue; }
    const dataset = item as MoonDatasetEntry;
    if (!nonEmpty(dataset.datasetId) || ids.has(dataset.datasetId)) errors.push(`${path}.datasetId is missing or duplicated.`); else ids.add(dataset.datasetId);
    for (const field of ["name", "category", "provider"] as const) if (!nonEmpty(dataset[field])) errors.push(`${path}.${field} is required.`);
    if (dataset.sourceUrl !== null && (!nonEmpty(dataset.sourceUrl) || !/^https:\/\//i.test(dataset.sourceUrl))) errors.push(`${path}.sourceUrl must be an HTTPS URL or null.`);
    if (!metadataStates.has(dataset.metadataStatus)) errors.push(`${path}.metadataStatus is invalid.`);
    if (!validCoordinateReference(dataset.coordinateReference)) errors.push(`${path}.coordinateReference is invalid or not Moon-specific.`);
    if (!dataset.spatialSupport || !["global", "near_global", "polar", "regional", "targeted", "unknown"].includes(dataset.spatialSupport.coverageClass) || !nonEmpty(dataset.spatialSupport.description)) errors.push(`${path}.spatialSupport is incomplete.`);
    if (!dataset.temporalSupport || !metadataStates.has(dataset.temporalSupport.status)) errors.push(`${path}.temporalSupport is invalid.`);
    if (dataset.temporalSupport.start && dataset.temporalSupport.end && Date.parse(dataset.temporalSupport.start) > Date.parse(dataset.temporalSupport.end)) errors.push(`${path}.temporalSupport start is after end.`);
    if (!Array.isArray(dataset.variables) || dataset.variables.length === 0) errors.push(`${path}.variables must describe at least one variable.`);
    else for (const [variableIndex, variable] of dataset.variables.entries()) {
      if (!nonEmpty(variable.id) || !nonEmpty(variable.name) || !nonEmpty(variable.semantics) || !evidenceClasses.has(variable.evidenceClass)) errors.push(`${path}.variables[${variableIndex}] lacks scientific semantics or a valid evidence class.`);
    }
    if (!dataset.quality || !metadataStates.has(dataset.quality.status)) errors.push(`${path}.quality status is invalid.`);
    if (!dataset.checksum || dataset.checksum.algorithm !== "SHA-256" || !metadataStates.has(dataset.checksum.status) || (dataset.checksum.value !== null && !/^[a-f0-9]{64}$/i.test(dataset.checksum.value))) errors.push(`${path}.checksum metadata is invalid.`);
    if (!dataset.license || !metadataStates.has(dataset.license.status) || !dataset.attribution || !metadataStates.has(dataset.attribution.status)) errors.push(`${path} license/attribution status is invalid.`);
    if (!dataset.lifecycle || Object.entries(dataset.lifecycle).some(([key, state]) => key === "acquisition" ? !acquisitionStates.has(state) : !lifecycleStates.has(state))) errors.push(`${path}.lifecycle contains an invalid state.`);
    if (dataset.lifecycle?.acquisition === "acquired" && dataset.checksum?.status !== "verified") errors.push(`${path} cannot be marked acquired without a verified checksum.`);
    if (dataset.lifecycle?.decoding === "completed" && dataset.lifecycle?.inspection !== "completed") errors.push(`${path} cannot be decoded before file-level inspection.`);
    if (dataset.lifecycle?.processing === "completed" && dataset.lifecycle?.decoding !== "completed") errors.push(`${path} cannot be processed before successful pixel decoding.`);
    if (dataset.lifecycle?.mapDelivery === "completed" && (dataset.lifecycle?.acquisition !== "acquired" || dataset.lifecycle?.inspection !== "completed" || dataset.lifecycle?.decoding !== "completed" || dataset.lifecycle?.processing !== "completed" || dataset.lifecycle?.validation !== "completed")) errors.push(`${path} cannot be delivery-ready before acquisition, inspection, decoding, processing, and validation.`);
    if (!Array.isArray(dataset.limitations) || dataset.limitations.length === 0 || dataset.limitations.some((limitation) => !nonEmpty(limitation))) errors.push(`${path}.limitations must be explicit non-empty strings.`);
    if (!nonEmpty(dataset.acquisitionAdapterId) || !nonEmpty(dataset.validationAdapterId)) errors.push(`${path} requires adapter identifiers.`);
  }
  if (ids.size !== 13) errors.push(`Moon registry must contain exactly 13 dataset families; received ${ids.size}.`);
  return errors;
}

export function validateCoverageSummary(value: CoverageSummary): string[] {
  const errors: string[] = [];
  const values = [value?.nominalFootprint, value?.observedDataCoverage, value?.validDataCoverage, value?.interpolatedCoverage, value?.unobservedCoverage];
  if (value?.units !== "fraction" || !nonEmpty(value.method) || !metadataStates.has(value.status)) errors.push("Coverage summary requires fraction units, a method, and a valid status.");
  if (values.some((number) => number !== null && (!Number.isFinite(number) || number < 0 || number > 1))) errors.push("Coverage fractions must be null or between zero and one.");
  if (value?.observedDataCoverage === null && value?.validDataCoverage === 1) errors.push("Valid-data coverage cannot be reported as complete when observed coverage is unknown.");
  return errors;
}

export function validateDerivedProductLineage(value: DerivedProductLineage): string[] {
  const errors: string[] = [];
  if (value?.schemaVersion !== "1.0.0") errors.push("Derived product lineage schemaVersion must be 1.0.0.");
  for (const [field, candidate] of Object.entries({ derivedProductId: value?.derivedProductId, inputDatasetId: value?.inputDatasetId, inputProductId: value?.inputProductId, inputProductVersion: value?.inputProductVersion, processingCodeVersion: value?.processingCodeVersion, nodataPolicy: value?.nodataPolicy })) if (!nonEmpty(candidate)) errors.push(`${field} is required.`);
  for (const field of ["inputSha256", "outputSha256"] as const) if (!/^[a-f0-9]{64}$/i.test(value?.[field] ?? "")) errors.push(`${field} must be a SHA-256 hex digest.`);
  if (!Array.isArray(value?.transformations) || value.transformations.length === 0 || value.transformations.some((item) => !nonEmpty(item))) errors.push("At least one explicit lineage transformation is required.");
  if (!validCoordinateReference(value?.coordinateReference)) errors.push("Derived product coordinate reference is invalid.");
  if (!Number.isFinite(Date.parse(value?.generatedAt ?? ""))) errors.push("generatedAt must be an ISO-compatible timestamp.");
  return errors;
}


export function validateCurrentMoonRegistry(): string[] {
  if (MOON_REGISTRY_VERSION !== "1.0.0") return ["Unexpected Moon registry version."];
  return validateMoonDatasetRegistry(MOON_DATASETS);
}
