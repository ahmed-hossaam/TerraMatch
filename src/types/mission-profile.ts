export type FactorRequirement = "required" | "optional" | "currently_unavailable";
export type EvidenceAvailability = "retrieved_subset" | "derived_subset" | "legacy_only" | "research_context_only" | "not_available";
export type EvidenceKind = "provider_gridded" | "provider_raster_sample" | "mapped_lithology" | "derived_from_provider_data" | "atlas_description" | "research_context" | "missing";

export interface FactorEvidenceAvailability {
  status: EvidenceAvailability;
  evidenceKind: EvidenceKind;
  sourceId: string | null;
  provider: string | null;
  dataset: string | null;
  sourceUrl: string | null;
  localDataPath: string | null;
  availableSiteIds: string[];
  observationPeriod: string | null;
  spatialResolution: string | null;
  temporalResolution: string | null;
  processingMethod: string | null;
}

export interface MissionFactor {
  id: string;
  name: string;
  definition: string;
  unit: string;
  requirementStatus: FactorRequirement;
  evidenceAvailability: FactorEvidenceAvailability;
  limitations: string[];
  nextEvidenceNeed: string | null;
}

export interface MissionDimension {
  id: string;
  name: string;
  whyItMatters: string;
  factors: MissionFactor[];
}

export interface MissionProfile {
  schemaVersion: "1.0.0";
  profileId: string;
  profileVersion: "1.0.0";
  targetPlanet: "Mars";
  targetEnvironment: "surface";
  status: "requirements_only";
  purpose: string;
  scientificCautions: string[];
  dimensions: MissionDimension[];
  missions: MissionDefinition[];
}

export interface MissionDefinition {
  id: string;
  name: string;
  objective: string;
  requiredFactorIds: string[];
  optionalFactorIds: string[];
  currentEvidenceState: "partial_evidence" | "insufficient_evidence";
  limitations: string[];
  nonGoals: string[];
}

export interface BlindBenchmarkProtocol {
  schemaVersion: "1.0.0";
  protocolId: string;
  protocolVersion: "1.0.0";
  status: "planning_only";
  scientificValidationStatus: "not_validated";
  referenceSet: {
    sourceManifest: string;
    knownReferenceCount: number;
    currentlyRetrievedSiteIds: string[];
    currentRetrievedCount: number;
    candidateRegionCount: number;
    testFixtureIds: string[];
    limitations: string[];
  };
  splitProposal: {
    status: "not_created_insufficient_independent_data";
    calibrationReferenceIds: string[];
    heldOutReferenceIds: string[];
    reason: string;
    groupingRule: string;
    minimumAdditionalEvidence: string[];
  };
  leakageControls: {
    labelStoreLocation: string;
    featureInputMustExclude: string[];
    retrievalCoordinateHandling: string;
    roleSeparation: string;
    fixtureHandling: string;
  };
  outcomeDefinitions: {
    validMatch: string;
    partialMatch: string;
    unsupported: string;
    missingEvidenceRule: string;
  };
  evaluationPlan: {
    evidenceRequiredPerResult: string[];
    futureReporting: string[];
    executionStatus: "not_run";
  };
}

export interface BlindFeaturePayload {
  evaluationKey: string;
  factors: Record<string, unknown>;
}
