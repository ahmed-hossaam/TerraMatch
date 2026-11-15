import type { LocationRecord, Measurement } from "../types/location.js";

const missing = (sourceId: string, unit: string | null): Measurement => ({ value: null, unit, sourceId, qualityStatus: "missing", processingMethod: "Not retrieved; test fixture", observationPeriod: null });
export function makeCandidateFixture(id: string, latitude: number, longitude: number): LocationRecord {
  const sourceId = "candidate-test-fixtures";
  const m = (unit: string | null) => missing(sourceId, unit);
  return { id, recordType: "test_fixture", planet: "Earth", latitude, longitude, coordinatesApproximate: false, country: null, regionName: null, discoveryMethod: "Fixed test coordinate; not a scientific discovery",
    elevationMeanM: m("m"), climate: { observationPeriod: null, meanTemperatureC: m("°C"), meanDailyTemperatureRangeC: m("°C"), meanHumidityPct: m("%"), annualPrecipitationMm: m("mm/year"), meanWindSpeedMs: m("m/s"), meanSolarRadiation: m("MJ/m²/day"), missingDays: null, validDays: null, coverage: null },
    terrain: { elevationMinM: m("m"), elevationMaxM: m("m"), slopeMeanDeg: m("°"), slopeP95Deg: m("°"), roughness: m(null), rasterResolutionM: null, sourceId: null, qualityStatus: "missing" },
    geology: { lithology: { classification: null, sourceId, qualityStatus: "missing" }, minerals: [], formationDescription: null, rockDescription: null, references: [], evidenceQuality: "missing" },
    dataQuality: { coverage: null, confidence: null, missingFactors: ["climate", "terrain", "lithology", "mineral evidence"], warnings: ["Test fixture only; not a confirmed analog or generated discovery."], validationErrors: [], qualityNotes: [] }, provenance: [], atlas: null };
}
export const candidateFixtures = [makeCandidateFixture("GRID-TEST-01", 22.25, 26.25), makeCandidateFixture("GRID-TEST-02", -24.25, -69.25), makeCandidateFixture("GRID-TEST-03", -77.25, 162.25)];
