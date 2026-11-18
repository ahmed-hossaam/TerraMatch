export interface LolaProcessedMetadata {
  schemaVersion: "1.0.0";
  product: { datasetId: string; productId: string; productVersion: string; dataSetId: string };
  sources: { jp2: { sha256: string; byteSize: number }; pdsLabel: { sha256: string; byteSize: number }; auxXml: { sha256: string; byteSize: number } };
  inputArray: { dimensionsLinesSamples: [number, number]; dtype: string };
  output: { dimensionsLinesSamples: [number, number]; dtype: string; byteSize: number; sha256: string; units: string };
  transform: { noDataRule: string; scaleApplied: number; offsetApplied: number; formula: string; referenceRadiusM: number; referenceRadiusAppliedToOutput: boolean };
  coordinateMetadata: { referenceFrame: string; projection: string; latitudeConvention: string; pixelRegistration: string; pixelCenterAndOrientation: string; pixelCenterEquations: { longitude: string; latitude: string }; pixelSizeDegrees: [number, number]; spatialMetadataSources: { title: string; url: string }[]; geotransform: unknown; georeferenced: boolean };
  coverageAndStatistics: { sampleCount: number; validSampleCount: number; noDataSampleCount: number; noDataLocationsRowColumnZeroBased: number[][]; validSampleStatistics: Record<string, unknown>; geographicValidCoverage: number | null };
  lifecycle: { processed: boolean; scientificallyValidated: boolean; deliveryReady: boolean; renderable: boolean; mapReady: boolean };
  unresolvedScientificDetails: string[];
}
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Structural/data-integrity checks only; this does not validate scientific accuracy. */
export function validateLolaProcessedMetadata(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Processed LOLA metadata must be an object."];
  const metadata = value as Partial<LolaProcessedMetadata>;
  const errors: string[] = [];
  if (metadata.schemaVersion !== "1.0.0" || metadata.product?.datasetId !== "moon-lola-global-topography" || metadata.product.productId !== "LDEM_4" || metadata.product.productVersion !== "V3.0") errors.push("Processed metadata identifies an unsupported product or schema.");
  for (const [name, source] of Object.entries(metadata.sources ?? {})) if (!sha(source?.sha256) || !Number.isSafeInteger(source.byteSize) || source.byteSize <= 0) errors.push(`${name} provenance is incomplete.`);
  if (!metadata.sources?.jp2 || !metadata.sources.pdsLabel || !metadata.sources.auxXml) errors.push("JP2, PDS label, and AUX XML provenance are required.");
  if (metadata.inputArray?.dimensionsLinesSamples?.[0] !== 720 || metadata.inputArray.dimensionsLinesSamples[1] !== 1440 || metadata.inputArray.dtype !== "int16") errors.push("Input array dimensions or dtype are invalid.");
  if (metadata.output?.dimensionsLinesSamples?.[0] !== 720 || metadata.output.dimensionsLinesSamples[1] !== 1440 || metadata.output.dtype !== "float32" || metadata.output.units !== "m" || !sha(metadata.output.sha256) || !Number.isSafeInteger(metadata.output.byteSize)) errors.push("Processed output metadata is invalid.");
  const transform = metadata.transform;
  if (!transform || transform.noDataRule !== "Raw DN equal to AUX NoDataValue -32768 becomes Float32 NaN; excluded from statistics." || transform.scaleApplied !== 0.5 || transform.offsetApplied !== 0 || transform.formula !== "relative surface height (m) = raw DN × 0.5" || transform.referenceRadiusM !== 1_737_400 || transform.referenceRadiusAppliedToOutput !== false) errors.push("NoData, scale, units, or reference-radius handling is invalid.");
  const coverage = metadata.coverageAndStatistics;
  if (!coverage || coverage.sampleCount !== 1_036_800 || coverage.validSampleCount + coverage.noDataSampleCount !== coverage.sampleCount || coverage.noDataLocationsRowColumnZeroBased.length !== coverage.noDataSampleCount || coverage.geographicValidCoverage !== null) errors.push("Sample counts or geographic coverage semantics are invalid.");
  const stats = coverage?.validSampleStatistics;
  if (!stats || !["minimum", "maximum", "mean", "standardDeviationPopulation", "median"].every((key) => finite(stats[key])) || !stats.percentiles || typeof stats.percentiles !== "object") errors.push("Valid-sample statistics are incomplete.");
  const coordinates = metadata.coordinateMetadata;
  if (!coordinates || coordinates.georeferenced !== false || coordinates.geotransform !== null || !coordinates.latitudeConvention.includes("planetocentric") || !coordinates.pixelRegistration.includes("pixel centers") || !coordinates.pixelCenterAndOrientation.includes("rows increase south") || coordinates.pixelCenterEquations?.longitude !== "(column - 719.5) / 4" || coordinates.pixelCenterEquations?.latitude !== "(359.5 - row) / 4" || coordinates.pixelSizeDegrees?.[0] !== 0.25 || coordinates.pixelSizeDegrees?.[1] !== 0.25 || !Array.isArray(coordinates.spatialMetadataSources) || coordinates.spatialMetadataSources.length < 2) errors.push("LOLA coordinate mapping must match the documented LDEM_4 pixel-center transform without claiming an encoded CRS.");
  const lifecycle = metadata.lifecycle;
  if (!lifecycle || lifecycle.processed !== true || lifecycle.scientificallyValidated !== false || lifecycle.deliveryReady !== false || lifecycle.renderable !== false || lifecycle.mapReady !== false) errors.push("Processing cannot imply scientific validation or map readiness.");
  if (!Array.isArray(metadata.unresolvedScientificDetails) || metadata.unresolvedScientificDetails.length < 2 || !metadata.unresolvedScientificDetails.some((item) => /independent.*(RDR|point)|cross-check/i.test(item)) || !metadata.unresolvedScientificDetails.some((item) => /coverage/i.test(item))) errors.push("Independent validation and coverage limitations must remain documented.");
  return errors;
}
