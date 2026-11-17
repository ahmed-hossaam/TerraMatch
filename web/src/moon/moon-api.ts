import { api } from "../api.js";
import type { MoonMapLayer } from "../../../src/moon/map-layers.js";
import type { MoonDatasetEntry } from "../../../src/moon/products/contracts.js";

export interface MoonSummary {
  schemaVersion: string; registryVersion: string; destination: { id: string; displayName: string; coordinateReferenceStatus: string };
  globalScope: string; counts: { registered: number; productSelected: number; metadataPartiallyVerified: number; acquired: number; inspected?: number; decoded?: number; processed: number; validated: number; renderable: number; researchPreviews: number };
  readiness: string; knownGaps: string[];
}
export interface MoonDatasetCollection { schemaVersion: string; items: MoonDatasetEntry[]; pagination: { offset: number; limit: number; total: number; nextOffset: number | null } }
export interface MoonLayers { schemaVersion: string; renderableLayers: MoonMapLayer[]; registeredButUnavailableLayers: MoonMapLayer[]; pagination: { offset: number; limit: number; total: number; nextOffset: number | null } }
export interface MoonCoverage { schemaVersion: string; coverageSemantics: Record<string, string>; datasets: Array<{ datasetId: string; classification: string; nominalProductFootprint: string; nominalResolution: string | null; effectiveResolution: string | null; observedDataCoverage: number | null; validDataCoverage: number | null; interpolatedOrDerivedCoverage: number | null; nodataOrUnobservedCoverage: number | null; coverageMeasurementStatus: string; productMetadataCoverageStatus: string; limitation: string }> }
export interface MoonMapConfig { schemaVersion: string; destinationId: "moon"; displayName: string; coordinateReference: MoonDatasetEntry["coordinateReference"]; coordinateReferenceStatus: string; projection: string; supportedProjections: string[]; center: { longitude: number; latitude: number }; zoom: number; referenceRadiusM: number | null; basemapId: null; tileService: null; prototype: boolean; prototypeNotice: string; longitudeWrapping: string }
export interface MoonLolaPreview {
  schemaVersion: string; previewStatus: "unvalidated_research_preview"; artifactId: string; datasetId: string;
  product: { id: string; version: string; dataSetId: string }; sourceUrl: string; attribution: string;
  image: { format: string; width: number; height: number; byteSize: number; sha256: string };
  input: { sha256: string; dimensionsLinesSamples: [number, number]; dtype: string; units: string };
  display: { variable: string; units: string; rangeM: [number, number]; rangeMethod: string; paletteAnchors: Array<{ fraction: number; rgb: number[] }>; noDataPolicy: string; finiteSampleCount: number; transparentSampleCount: number; sourceArrayValuesModified: false };
  coordinateReference: { body: string; frame: string; projection: string; latitudeType: string; longitudeDirection: string; longitudeBoundsDegrees: [number, number]; latitudeBoundsDegrees: [number, number]; pixelRegistration: string; pixelSizeDegrees: [number, number]; zeroBasedPixelCenterEquations: { longitude: string; latitude: string }; rowOrientation: string; columnOrientation: string; referenceRadiusM: number; geotiffCrsAssigned: false };
  scientificStatus: { processedInput: boolean; spatialMappingDocumented: boolean; independentPointCrossCheck: boolean; scientificallyValidated: boolean; deliveryReady: boolean; renderableAsValidatedLayer: boolean; mapReady: boolean; previewLabel: string; coverage: string };
  limitations: string[]; dataPathExposed: false;
}
export interface MoonLolaPolarPreview {
  artifactId: string; hemisphere: "north" | "south";
  image: { format: string; width: number; height: number; pixelSizeM: number; byteSize: number; sha256: string };
  projection: { name: string; hemisphere: "north" | "south"; targetBody: string; referenceFrame: string; latitudeType: string; longitudeDirection: string; longitudeOriginDegrees: number; referenceSphereRadiusM: number; trueScaleAtPole: boolean; angularDomain: string; cutoffLatitudeDegrees: number; projectedCutoffRadiusM: number; forwardEquations: Record<string, string>; inverseEquations: Record<string, string>; rasterPixelRegistration: string; coordinateToSourceGrid: string };
  display: { variable: string; units: string; rangeM: [number, number]; rangeMethod: string; sampling: string; transparentOutsideProjectionDomainPixels: number; finiteSourceSamplePixels: number; nonFiniteSourceSamplePixels: number; sourceValuesModified: false };
  scientificStatus: { independentPointValidation: boolean; scientificallyValidated: boolean; validatedLayer: boolean; previewOnly: boolean; mapReady: boolean };
  provenance: { sourceDataset: string; sourceProduct: string; sourceUrl: string; renderingScript: string };
  limitations: string[];
}
export interface MoonLolaPolarPreviews { schemaVersion: string; previewStatus: "unvalidated_research_preview"; projections: MoonLolaPolarPreview[]; dataPathExposed: false }

export function getMoonSummary(): Promise<MoonSummary> { return api("/moon/summary"); }
export function getMoonDatasets(): Promise<MoonDatasetCollection> { return api("/moon/datasets?offset=0&limit=13"); }
export function getMoonLayers(): Promise<MoonLayers> { return api("/moon/layers?offset=0&limit=13"); }
export function getMoonCoverage(): Promise<MoonCoverage> { return api("/moon/coverage"); }
export function getMoonMapConfig(): Promise<MoonMapConfig> { return api("/moon/map-config"); }
export function getMoonLolaPreview(): Promise<MoonLolaPreview> { return api("/moon/lola/preview"); }
export function getMoonLolaPolarPreviews(): Promise<MoonLolaPolarPreviews> { return api("/moon/lola/polar-previews"); }
export function getMoonDataset(datasetId: string): Promise<{ schemaVersion: string; dataset: MoonDatasetEntry; mapLayer: MoonMapLayer | null; statusExplanation: string }> {
  return api(`/moon/datasets/${encodeURIComponent(datasetId)}`);
}
