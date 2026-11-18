type DailyRecord = { date?: string; measurements?: Record<string, { value?: number | null; unit?: string; qualityStatus?: string }> };
type ClimateHistory = { provider?: string; locationId?: string; requestedCoordinate?: { latitude?: number; longitude?: number }; actualObservationPeriod?: { start?: string; end?: string }; daily?: DailyRecord[]; summaries?: Record<string, { validObservationCount?: number; missingObservationCount?: number }> };

function quantile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * (position - lower);
}

function distribution(values: number[]) {
  const sum = values.reduce((total, value) => total + value, 0);
  return { count: values.length, mean: sum / values.length, min: Math.min(...values), q25: quantile(values, 0.25), median: quantile(values, 0.5), q75: quantile(values, 0.75), max: Math.max(...values) };
}

/** Side-by-side temperature evidence. Returns no cross-source delta because supports differ. */
export function createMarsTemperatureContext(candidate: ClimateHistory, rems: any) {
  if (candidate.provider !== "NASA POWER") throw new Error("Candidate climate history is not identified as NASA POWER.");
  if (!Array.isArray(candidate.daily)) throw new Error("Candidate daily climate observations are unavailable.");
  const earthKelvin: number[] = [];
  const earthDates: string[] = [];
  for (const row of candidate.daily) {
    const item = row.measurements?.T2M;
    if (item?.qualityStatus !== "valid" || typeof item.value !== "number" || !Number.isFinite(item.value)) continue;
    if (item.unit !== "°C") throw new Error("NASA POWER T2M unit is not the expected degrees Celsius.");
    earthKelvin.push(item.value + 273.15);
    if (typeof row.date === "string") earthDates.push(row.date);
  }
  const solMeans = (rems?.solSummaries ?? []).filter((row: any) => Number.isFinite(row.sampleMeanK) && row.validSampleCount > 0);
  if (!earthKelvin.length || !solMeans.length || rems?.measurement?.unit !== "K") return null;
  const marsMeansK = solMeans.map((row: any) => row.sampleMeanK as number);
  return {
    schemaVersion: "1.0.0",
    status: "ambiguous" as const,
    factorId: "air_temperature_distribution",
    unit: "K",
    candidate: {
      source: "NASA POWER Daily Point API · T2M",
      measurementType: "Gridded/model-derived daily 2 m air-temperature estimate",
      period: candidate.actualObservationPeriod ?? null,
      requestedCoordinate: candidate.requestedCoordinate ?? null,
      statistics: distribution(earthKelvin),
      missingObservationCount: candidate.summaries?.T2M?.missingObservationCount ?? null,
      conversion: "NASA POWER T2M °C converted to K by adding 273.15 for display in a shared unit.",
    },
    target: {
      source: rems.dataset?.provider ?? "NASA PDS Atmospheres Node / Curiosity REMS",
      product: rems.dataset?.datasetId ?? "MSL-M-REMS-5-MODRDR-V1.0",
      measurementType: rems.measurement.type,
      parameter: rems.measurement.parameter,
      solRange: { first: rems.coverage.firstSelectedSol, last: rems.coverage.lastSelectedSol },
      solCount: solMeans.length,
      sols: solMeans.map((row: any) => ({ sol: row.sol, solarLongitudeDegrees: row.solarLongitudeDegrees, sampleMeanK: row.sampleMeanK, acceptedSamples: row.validSampleCount })),
      acceptedRawSampleCount: rems.qualityControl.validSampleCount,
      rejectedRawSampleCount: rems.qualityControl.rejectedSampleCount,
      statisticsAcrossSelectedSolMeans: distribution(marsMeansK),
    },
    method: "Side-by-side distribution summaries. Earth daily means are compared descriptively with the mean of accepted REMS samples within each selected sol; no Earth-day/Mars-sol alignment or cross-source difference is calculated.",
    limitations: [
      "Status is ambiguous because NASA POWER is a gridded/model-derived Earth estimate at 2 m, while REMS is a rover-mounted, processed/model-corrected ambient-air estimate.",
      "Earth daily observations span the recorded Earth period; REMS covers a focused set of selected sols and irregular within-sol sampling, not a continuous climate record.",
      "The shared unit conversion does not harmonize instruments, measurement height, spatial support, sampling cadence, or observation period.",
      "This is descriptive context only; it is not a paired observation, similarity score, analog verdict, or mission-suitability result.",
    ],
  };
}
