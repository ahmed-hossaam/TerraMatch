import type { CoordinateReference } from "../../destinations/types.js";

export type ScientificEvidenceClass = "in_situ_observation" | "remote_sensing_observation" | "derived_product" | "interpreted_mapping" | "modeled_indicator" | "research_hypothesis";
export type MetadataState = "verified" | "partial" | "unverified" | "unknown";
export type LifecycleState = "not_started" | "implemented" | "completed" | "blocked" | "not_applicable";
export type AcquisitionState = "not_acquired" | "partial_coverage" | "acquired" | "unavailable" | "failed" | "unknown";

export interface ProductVariable {
  id: string;
  name: string;
  unit: string | null;
  semantics: string;
  evidenceClass: ScientificEvidenceClass;
}
export interface SpatialSupport {
  coverageClass: "global" | "near_global" | "polar" | "regional" | "targeted" | "unknown";
  description: string;
  nominalResolution: string | null;
  effectiveResolution: string | null;
  validCoverage: MetadataState;
  interpolatedCoverage: MetadataState;
}
export interface TemporalSupport { start: string | null; end: string | null; cadence: string | null; accumulation: string | null; status: MetadataState; }
export interface ProductQuality { nodataEncoding: string | null; qualityLayers: string[]; uncertaintyDescription: string | null; status: MetadataState; }
export interface ProcessingStep { version: string; description: string; codeReference: string | null; }
export interface MoonDatasetEntry {
  datasetId: string;
  name: string;
  category: string;
  provider: string;
  mission: string | null;
  instrument: string | null;
  sourceArchiveId: string | null;
  sourceUrl: string | null;
  /** Official product-file endpoint, separate from a landing page or documentation URL. */
  downloadUrl: string | null;
  /** Provider-advertised archive size, not proof that local bytes were acquired. */
  advertisedPackageSizeBytes: number | null;
  productId: string | null;
  productVersion: string | null;
  release: string | null;
  fileFormats: string[];
  acquisitionDate: string | null;
  processingLevel: string | null;
  metadataStatus: MetadataState;
  sourceProductRelationships: string[];
  coordinateReference: CoordinateReference;
  spatialSupport: SpatialSupport;
  temporalSupport: TemporalSupport;
  variables: ProductVariable[];
  nodata: string | null;
  quality: ProductQuality;
  calibration: string | null;
  processingHistory: ProcessingStep[];
  checksum: { algorithm: string; value: string | null; status: MetadataState };
  license: { status: MetadataState; terms: string | null; redistribution: string | null };
  attribution: { status: MetadataState; citation: string | null; url: string | null };
  limitations: string[];
  lifecycle: {
    registration: LifecycleState;
    productSelection: LifecycleState;
    metadataVerification: LifecycleState;
    acquisitionAdapter: LifecycleState;
    acquisition: AcquisitionState;
    /** File-level inspection, distinct from metadata review or product validation. */
    inspection: LifecycleState;
    /** Actual decompression/pixel decode, distinct from container/header inspection. */
    decoding: LifecycleState;
    processing: LifecycleState;
    validation: LifecycleState;
    mapDelivery: LifecycleState;
  };
  acquisitionAdapterId: string | null;
  validationAdapterId: string | null;
}

export interface DerivedProductLineage {
  derivedProductId: string;
  schemaVersion: "1.0.0";
  inputDatasetId: string;
  inputProductId: string;
  inputProductVersion: string;
  inputSha256: string;
  processingCodeVersion: string;
  transformations: string[];
  outputUnits: Record<string, string | null>;
  coordinateReference: CoordinateReference;
  nodataPolicy: string;
  generatedAt: string;
  outputSha256: string;
}

export interface CoverageSummary {
  nominalFootprint: number | null;
  observedDataCoverage: number | null;
  validDataCoverage: number | null;
  interpolatedCoverage: number | null;
  unobservedCoverage: number | null;
  units: "fraction";
  method: string;
  status: MetadataState;
}
