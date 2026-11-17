export interface LolaDecodeDiagnostics {
  schemaVersion: "1.0.0";
  product: { datasetId: "moon-lola-global-topography"; productId: "LDEM_4"; productVersion: "V3.0"; dataSetId: "LRO-L-LOLA-4-GDR-V1.0" };
  source: { jp2: { byteSize: number; sha256: string; expectedIntegrityMatched: boolean }; label: { byteSize: number; sha256: string; expectedIntegrityMatched: boolean } };
  execution: { pythonVersion: string; imagecodecsVersion: string; numpyVersion: string; decoder: string; executedAtUtc: string };
  decodedFacts: {
    decodeSucceeded: boolean; shapeLinesSamples: [number, number]; dtype: string; sampleKind: string; sampleBits: number;
    totalSampleCount: number; finiteSampleCount: number;
    rawStatistics: { minimum: number; maximum: number; mean: number; standardDeviationPopulation: number; median: number; percentiles: Record<string, number> };
    extremeSampleCounts: { minimumValue: number; minimumCount: number; maximumValue: number; maximumCount: number };
    samplePositions: { indexing: string; values: Array<{ rowZeroBased: number; columnZeroBased: number; rawValue: number }> };
    firstFiveRowsFirstTenColumns: number[][];
  };
  pdsLabelDeclarations: { declaredLines: number; declaredLineSamples: number; sampleType: string; sampleBits: number; declaredMinimum: number; declaredMaximum: number; decodedExtremaMatchLabel: boolean; missingConstantPresent: boolean; missingValuePresent: boolean };
  unresolvedInterpretations: string[];
  processingStatus: { processed: false; scientificallyValidated: false; deliveryReady: false; renderable: false; mapReady: false; physicalTransformApplied: false };
}

const expectedSources = {
  jp2: { byteSize: 1_436_447, sha256: "9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3" },
  label: { byteSize: 6_602, sha256: "102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8" },
};
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Validate facts and safety boundaries of the decoder report; never validate scientific meaning. */
export function validateLolaDecodeDiagnostics(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Diagnostics must be an object."];
  const report = value as Partial<LolaDecodeDiagnostics>;
  const errors: string[] = [];
  if (report.schemaVersion !== "1.0.0") errors.push("Unsupported diagnostics schema version.");
  if (report.product?.datasetId !== "moon-lola-global-topography" || report.product.productId !== "LDEM_4" || report.product.productVersion !== "V3.0" || report.product.dataSetId !== "LRO-L-LOLA-4-GDR-V1.0") errors.push("Diagnostics identify an unexpected product.");
  for (const key of ["jp2", "label"] as const) {
    const actual = report.source?.[key];
    if (!actual || actual.byteSize !== expectedSources[key].byteSize || actual.sha256?.toUpperCase() !== expectedSources[key].sha256 || actual.expectedIntegrityMatched !== true) errors.push(`${key} source integrity does not match the expected source.`);
  }
  const execution = report.execution;
  if (!execution || ![execution.pythonVersion, execution.imagecodecsVersion, execution.numpyVersion, execution.decoder].every((item) => typeof item === "string" && item.length > 0) || !Number.isFinite(Date.parse(execution?.executedAtUtc ?? ""))) errors.push("Decoder execution metadata is incomplete.");
  const facts = report.decodedFacts;
  if (!facts || facts.decodeSucceeded !== true || facts.shapeLinesSamples?.[0] !== 720 || facts.shapeLinesSamples?.[1] !== 1440 || facts.dtype !== "int16" || facts.sampleKind !== "signed integer" || facts.sampleBits !== 16) errors.push("Decoded dimensions or signed 16-bit sample contract is invalid.");
  if (facts?.totalSampleCount !== 1_036_800 || facts.finiteSampleCount !== facts.totalSampleCount) errors.push("Decoded sample counts are invalid or non-finite values are present.");
  const statistics = facts?.rawStatistics;
  if (!statistics || ![statistics.minimum, statistics.maximum, statistics.mean, statistics.standardDeviationPopulation, statistics.median, ...Object.values(statistics.percentiles ?? {})].every(finite)) errors.push("Raw decoded statistics are incomplete or non-finite.");
  if (Object.keys(statistics?.percentiles ?? {}).sort().join(",") !== "1,25,5,50,75,95,99") errors.push("Required percentile set is incomplete.");
  if (!facts?.samplePositions?.values?.length || !facts.samplePositions.indexing.includes("zero-based") || !Array.isArray(facts.firstFiveRowsFirstTenColumns) || facts.firstFiveRowsFirstTenColumns.length !== 5 || facts.firstFiveRowsFirstTenColumns.some((row) => row.length !== 10)) errors.push("Actual sample position diagnostics are missing.");
  if (!report.pdsLabelDeclarations || report.pdsLabelDeclarations.decodedExtremaMatchLabel !== true || report.pdsLabelDeclarations.missingConstantPresent !== false || report.pdsLabelDeclarations.missingValuePresent !== false) errors.push("PDS label comparison or missing-value disclosure is invalid.");
  if (!Array.isArray(report.unresolvedInterpretations) || report.unresolvedInterpretations.length < 3) errors.push("Unresolved scientific interpretations must remain explicit.");
  const status = report.processingStatus;
  if (!status || status.processed !== false || status.scientificallyValidated !== false || status.deliveryReady !== false || status.renderable !== false || status.mapReady !== false || status.physicalTransformApplied !== false) errors.push("Pixel decoding cannot imply processing, validation, delivery, or map readiness.");
  const serialized = JSON.stringify(value);
  if (/[A-Za-z]:\\(?:Users|terra-moon-cache)\\|(?:DATABASE_URL|BLOB_READ_WRITE_TOKEN|password)=/i.test(serialized)) errors.push("Diagnostics must not expose local paths or secrets.");
  return errors;
}
