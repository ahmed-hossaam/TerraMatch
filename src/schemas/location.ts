import type { LocationRecord } from "../types/location.js";

export function validateLocation(record: LocationRecord): string[] {
  const errors: string[] = [];
  if (!record.id) errors.push("id is required");
  if (!(["known_analog", "candidate_region", "test_fixture"] as string[]).includes(record.recordType)) errors.push("invalid recordType");
  for (const [name, measurement] of Object.entries({ ...record.climate, elevation: record.elevationMeanM, elevationSample: record.elevationSampleM, ...record.terrain })) {
    if (measurement && typeof measurement === "object" && "value" in measurement) {
      const m = measurement as { value: number | null; unit: string | null; sourceId: string; qualityStatus: string; processingMethod: string };
      if (m.value !== null && !Number.isFinite(m.value)) errors.push(`${name}.value must be finite or null`);
      if (!m.sourceId || !m.processingMethod) errors.push(`${name} requires source and processing method`);
      if (m.value === null && m.qualityStatus !== "missing") errors.push(`${name} null value must have missing quality status`);
    }
  }
  if (record.climate.coverage !== null && (record.climate.coverage < 0 || record.climate.coverage > 1)) errors.push("climate.coverage must be between 0 and 1");
  if (!Array.isArray(record.geology.minerals) || !Array.isArray(record.provenance)) errors.push("geology minerals and provenance must be arrays");
  return errors;
}
