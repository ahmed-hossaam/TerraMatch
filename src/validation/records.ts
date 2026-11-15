import { validateLocation } from "../schemas/location.js";
import type { LocationRecord } from "../types/location.js";

export function validateRecords(records: LocationRecord[]) {
  const errors: { id: string; message: string }[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) errors.push({ id: record.id, message: "Duplicate ID" });
    seen.add(record.id);
    if (record.latitude != null && (record.latitude < -90 || record.latitude > 90)) errors.push({ id: record.id, message: "Latitude outside [-90, 90]" });
    if (record.longitude != null && (record.longitude < -180 || record.longitude > 180)) errors.push({ id: record.id, message: "Longitude outside [-180, 180]" });
    for (const message of validateLocation(record)) errors.push({ id: record.id, message });
  }
  return errors;
}
