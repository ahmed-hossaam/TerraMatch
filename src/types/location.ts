export type RecordType = "known_analog" | "candidate_region" | "test_fixture";
export type QualityStatus = "legacy_value" | "descriptive" | "needs_verification" | "verified" | "missing";

export interface Provenance {
  sourceId: string; provider: string; endpointOrDataset: string | null; sourceUrl: string | null;
  retrievedAt: string | null; requestParameters: Record<string, unknown> | null;
  originalUnit: string | null; outputUnit: string | null; processingMethod: string;
  spatialResolution: string | null; temporalResolution: string | null; qualityStatus: QualityStatus;
}
export interface Measurement<T = number> {
  value: T | null; unit: string | null; sourceId: string; qualityStatus: QualityStatus;
  processingMethod: string; observationPeriod: string | null;
}
export interface Climate {
  observationPeriod: string | null;
  meanTemperatureC: Measurement; meanDailyTemperatureRangeC: Measurement;
  meanHumidityPct: Measurement; annualPrecipitationMm: Measurement;
  meanWindSpeedMs: Measurement; meanSolarRadiation: Measurement;
  missingDays: number | null; validDays: number | null; coverage: number | null;
}
export interface MineralEvidence {
  mineralName: string; evidenceType: "atlas_description"; source: string;
  locationSpecific: boolean; verified: boolean; notes: string | null;
}
export interface LocationRecord {
  id: string; recordType: RecordType; planet: "Earth"; latitude: number | null; longitude: number | null;
  coordinatesApproximate: boolean | null; country: string | null; regionName: string | null;
  discoveryMethod: string; elevationMeanM: Measurement; elevationSampleM?: Measurement; climate: Climate;
  terrain: { elevationMinM: Measurement; elevationMaxM: Measurement; slopeMeanDeg: Measurement; slopeP95Deg: Measurement; roughness: Measurement; rasterResolutionM: number | null; sourceId: string | null; qualityStatus: QualityStatus };
  geology: { lithology: { classification: string | null; sourceId: string; qualityStatus: QualityStatus }; minerals: MineralEvidence[]; formationDescription: string | null; rockDescription: string | null; references: { label: string; url: string }[]; evidenceQuality: QualityStatus };
  dataQuality: { coverage: number | null; confidence: number | null; missingFactors: string[]; warnings: string[]; validationErrors: string[]; qualityNotes: string[] };
  provenance: Provenance[];
  atlas: { nameAr: string; nameEn: string; analogType: string | null; marsCounterpart: string | null; whyMarsLike: string | null; missionsUses: string | null; climateMarsScore: number | null; climateMarsScoreNote: string } | null;
}
