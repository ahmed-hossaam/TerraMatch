type Measurement = { value?: number | null; unit?: string; qualityStatus?: string };
type DailyRow = { date?: string; measurements?: Record<string, Measurement> };
export type CandidateClimateHistory = {
  provider?: string;
  locationId?: string;
  latitude?: number;
  longitude?: number;
  requestedCoordinate?: { latitude?: number; longitude?: number };
  providerResponseCoordinate?: { latitude?: number; longitude?: number };
  actualObservationPeriod?: { start?: string; end?: string };
  parameters?: string[];
  spatialResolution?: string;
  daily?: DailyRow[];
  provenance?: { sourceId?: string; endpoint?: string; retrievedAt?: string; spatialResolution?: string; temporalResolution?: string };
};

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { count: values.length, mean: mean(values), median, minimum: sorted[0], maximum: sorted.at(-1) };
}

/** Paired-date comparison of the same NASA POWER parameters; it does not calculate an analog score. */
export function compareCandidateClimate(a: CandidateClimateHistory, b: CandidateClimateHistory) {
  if (a.provider !== "NASA POWER" || b.provider !== "NASA POWER") throw new Error("Both candidates must have NASA POWER climate histories.");
  if (!Array.isArray(a.daily) || !Array.isArray(b.daily)) throw new Error("Candidate daily histories are unavailable.");
  const rowsA = new Map(a.daily.filter((row) => typeof row.date === "string").map((row) => [row.date!, row]));
  const rowsB = new Map(b.daily.filter((row) => typeof row.date === "string").map((row) => [row.date!, row]));
  const parameterIds = [...new Set(a.parameters ?? [])].filter((id) => (b.parameters ?? []).includes(id)).sort();
  const factors = parameterIds.map((parameterId) => {
    const valuesA: number[] = [], valuesB: number[] = [], pairedDates: string[] = [];
    let unit: string | null = null, unitMismatch = false;
    for (const [date, rowA] of rowsA) {
      const rowB = rowsB.get(date);
      const valueA = rowA.measurements?.[parameterId], valueB = rowB?.measurements?.[parameterId];
      if (!rowB || valueA?.qualityStatus !== "valid" || valueB?.qualityStatus !== "valid" || typeof valueA.value !== "number" || !Number.isFinite(valueA.value) || typeof valueB.value !== "number" || !Number.isFinite(valueB.value)) continue;
      if (!valueA.unit || !valueB.unit || valueA.unit !== valueB.unit || (unit !== null && unit !== valueA.unit)) { unitMismatch = true; continue; }
      unit = valueA.unit;
      valuesA.push(valueA.value); valuesB.push(valueB.value); pairedDates.push(date);
    }
    if (unitMismatch) return { parameterId, unit: null, status: "unavailable" as const, pairedObservationCount: 0, reason: "Matched records do not have one consistent shared unit." };
    if (!valuesA.length || !unit) return { parameterId, unit: null, status: "unavailable" as const, pairedObservationCount: 0, reason: "No valid same-date observations with matching units are shared." };
    const differences = valuesB.map((value, index) => value - valuesA[index]);
    pairedDates.sort();
    return { parameterId, unit, status: "compared" as const, pairedObservationCount: valuesA.length, period: { start: pairedDates[0], end: pairedDates.at(-1) }, candidateA: stats(valuesA), candidateB: stats(valuesB), identicalMatchedValues: differences.every((value) => value === 0), differenceBMinusA: { mean: mean(differences), median: stats(differences).median, unit } };
  });
  const record = (history: CandidateClimateHistory) => ({ candidateId: history.locationId ?? null, requestedCoordinate: history.requestedCoordinate ?? null, providerResponseCoordinate: history.providerResponseCoordinate ?? null, period: history.actualObservationPeriod ?? null, source: history.provenance?.sourceId ?? "NASA POWER", endpoint: history.provenance?.endpoint ?? null, spatialResolution: history.spatialResolution ?? history.provenance?.spatialResolution ?? null, temporalResolution: history.provenance?.temporalResolution ?? "Daily" });
  return {
    schemaVersion: "1.0.0",
    status: factors.some((factor) => factor.status === "compared") ? "descriptive" as const : "unavailable" as const,
    records: { candidateA: record(a), candidateB: record(b) },
    factors,
    method: "For each shared NASA POWER parameter, compare valid values on matching Earth calendar dates only. Difference is candidate B minus candidate A; no gaps are filled or dates resampled.",
    limitations: ["NASA POWER values are gridded/model-derived estimates, not field-station observations.", "This is a same-source Earth-to-Earth descriptive comparison, not an Earth-to-Mars/Moon comparison, analog score, ranking, or suitability verdict.", "Only shared valid dates and parameters are included; spatial grid support and requested coordinates remain attached to provenance."],
  };
}
