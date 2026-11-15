import { NASA_POWER_PARAMETERS, type NasaPowerParameterId } from "./config.js";
import type { DailyRequest } from "./request.js";

export interface PowerResponse {
  header?: { fill_value?: number; start?: string; end?: string; latitude?: number; longitude?: number; time_standard?: string; [key: string]: unknown };
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { parameter?: Record<string, Record<string, unknown>>; [key: string]: unknown };
  parameters?: Record<string, { units?: string; longname?: string }>;
  messages?: unknown;
  [key: string]: unknown;
}
export type DailyQuality = "valid" | "missing_sentinel" | "not_returned" | "invalid_value";
export interface DailyMeasurement {
  value: number | null; unit: string; provider: "NASA POWER"; parameterId: string;
  observationDate: string; qualityStatus: DailyQuality; rawValue: unknown;
  processingMethod: string;
}
export interface ParsedDay { date: string; measurements: Partial<Record<NasaPowerParameterId, DailyMeasurement>>; temperatureRangeC: DailyMeasurement | null; }
export interface ParameterSummary {
  unit: string; requestedDayCount: number; validObservationCount: number; missingObservationCount: number;
  coverage: number; coveragePercent: number; mean: number | null; minimum: number | null; maximum: number | null;
  firstAvailableDate: string | null; lastAvailableDate: string | null;
}
export interface AnnualPrecipitation {
  year: number; totalMm: number | null; partialObservedSumMm: number | null;
  validDays: number; expectedDays: number; complete: boolean;
  status: "complete" | "incomplete_year_or_missing_days";
}
export interface NormalizedClimateResult {
  locationId: string; latitude: number; longitude: number; coordinatesApproximate: boolean | null;
  requestedCoordinate: { latitude: number; longitude: number };
  providerResponseCoordinate: { longitude: number | null; latitude: number | null; elevationM: number | null };
  provider: "NASA POWER"; endpoint: string; community: string; timeStandard: "UTC";
  requestedPeriod: { start: string; end: string }; actualObservationPeriod: { start: string | null; end: string | null };
  parameters: NasaPowerParameterId[]; daily: ParsedDay[];
  summaries: Partial<Record<NasaPowerParameterId, ParameterSummary>>;
  annualPrecipitation: AnnualPrecipitation[]; warnings: string[];
  provenance: { sourceId: string; provider: string; endpoint: string; sourceUrl: string; retrievedAt: string; requestParameters: Record<string, string>; originalUnits: Record<string, string>; outputUnits: Record<string, string>; processingMethod: string; spatialResolution: string; temporalResolution: string; qualityStatus: "needs_verification" | "verified" };
}

function dateList(start: string, end: string): string[] {
  const output: string[] = [];
  for (let day = new Date(`${start}T00:00:00Z`); day <= new Date(`${end}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) output.push(day.toISOString().slice(0, 10));
  return output;
}

export function assertValidPowerResponse(payload: unknown): asserts payload is PowerResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("NASA POWER response must be a JSON object.");
  const response = payload as PowerResponse;
  if (!response.header || typeof response.header !== "object") throw new Error("NASA POWER response is missing header metadata.");
  if (!response.properties || typeof response.properties !== "object" || !response.properties.parameter || typeof response.properties.parameter !== "object") {
    const message = Array.isArray(response.messages) ? response.messages.join("; ") : typeof response.messages === "string" ? response.messages : "";
    throw new Error(`NASA POWER response is missing properties.parameter.${message ? ` API message: ${message}` : ""}`);
  }
  if (!response.parameters || typeof response.parameters !== "object") throw new Error("NASA POWER response is missing per-parameter unit metadata.");
}
function normalizeUnit(unit: string): string {
  const compact = unit.toLowerCase().replaceAll(" ", "").replaceAll("²", "^2");
  if (["c", "°c", "degc", "celsius"].includes(compact)) return "°C";
  if (["%", "percent", "0to100%"].includes(compact)) return "%";
  if (compact === "mm/day") return "mm/day";
  if (compact === "m/s") return "m/s";
  if (["mj/m^2/day", "mj/m2/day"].includes(compact)) return "MJ/m²/day";
  return unit;
}

export function normalizeDailyResponse(args: {
  payload: unknown; request: Required<DailyRequest>; locationId: string; coordinatesApproximate: boolean | null;
  retrievedAt: string; sourceUrl: string; sourceResolution?: string;
}): NormalizedClimateResult {
  assertValidPowerResponse(args.payload);
  const payload = args.payload;
  const paramData = payload.properties!.parameter!;
  const geometryCoordinates = payload.geometry?.type === "Point" && Array.isArray(payload.geometry.coordinates) ? payload.geometry.coordinates : null;
  const responseCoordinate = {
    longitude: typeof geometryCoordinates?.[0] === "number" && Number.isFinite(geometryCoordinates[0]) ? geometryCoordinates[0] : null,
    latitude: typeof geometryCoordinates?.[1] === "number" && Number.isFinite(geometryCoordinates[1]) ? geometryCoordinates[1] : null,
    elevationM: typeof geometryCoordinates?.[2] === "number" && Number.isFinite(geometryCoordinates[2]) ? geometryCoordinates[2] : null
  };
  const warnings: string[] = [];
  for (const parameterId of args.request.parameters) {
    const metadata = payload.parameters?.[parameterId];
    if (!metadata?.units) throw new Error(`NASA POWER response has no units metadata for ${parameterId}.`);
    const expectedUnit = NASA_POWER_PARAMETERS[parameterId].unit;
    if (normalizeUnit(metadata.units) !== expectedUnit) throw new Error(`NASA POWER unit mismatch for ${parameterId}: expected ${expectedUnit}, received ${metadata.units}.`);
    if (!metadata.longname) warnings.push(`NASA POWER omitted the descriptive name for ${parameterId}; parameter ID retained.`);
  }
  const days = dateList(args.request.start, args.request.end);
  const sentinel = typeof payload.header!.fill_value === "number" ? payload.header!.fill_value : -999;
  if (payload.header!.time_standard && payload.header!.time_standard !== "UTC") throw new Error(`NASA POWER returned time_standard=${payload.header!.time_standard}; UTC was requested.`);
  const daily: ParsedDay[] = days.map(date => {
    const key = date.replaceAll("-", "");
    const measurements: Partial<Record<NasaPowerParameterId, DailyMeasurement>> = {};
    for (const parameterId of args.request.parameters) {
      const definition = NASA_POWER_PARAMETERS[parameterId];
      const series = paramData[parameterId];
      const rawValue = series && Object.hasOwn(series, key) ? series[key] : undefined;
      let value: number | null = null;
      let qualityStatus: DailyQuality;
      if (rawValue === undefined) qualityStatus = "not_returned";
      else if (typeof rawValue === "number" && (!Number.isFinite(rawValue) || rawValue === sentinel)) qualityStatus = rawValue === sentinel ? "missing_sentinel" : "invalid_value";
      else if (typeof rawValue === "number") { value = rawValue; qualityStatus = "valid"; }
      else if (typeof rawValue === "string" && rawValue.trim() !== "" && Number.isFinite(Number(rawValue))) {
        const numeric = Number(rawValue);
        if (numeric === sentinel) qualityStatus = "missing_sentinel";
        else { value = numeric; qualityStatus = "valid"; }
      } else qualityStatus = "invalid_value";
      measurements[parameterId] = { value, unit: definition.unit, provider: "NASA POWER", parameterId, observationDate: date, qualityStatus, rawValue: rawValue === undefined ? null : rawValue, processingMethod: "NASA POWER daily value; sentinel mapped to null; source units from NASA parameter dictionary" };
    }
    const max = measurements.T2M_MAX, min = measurements.T2M_MIN;
    const qualityStatus = max?.value !== null && max?.value !== undefined && min?.value !== null && min?.value !== undefined ? "valid" as const : max?.qualityStatus === "not_returned" || min?.qualityStatus === "not_returned" ? "not_returned" as const : max?.qualityStatus === "invalid_value" || min?.qualityStatus === "invalid_value" ? "invalid_value" as const : "missing_sentinel" as const;
    const temperatureRangeC = max && min ? {
      value: max.value !== null && min.value !== null ? max.value - min.value : null,
      unit: "°C", provider: "NASA POWER" as const, parameterId: "T2M_MAX-T2M_MIN",
      observationDate: date, qualityStatus,
      rawValue: max.value !== null && min.value !== null ? { maximum: max.rawValue, minimum: min.rawValue } : null,
      processingMethod: "Daily temperature range = T2M_MAX - T2M_MIN; null unless both inputs are valid"
    } : null;
    return { date, measurements, temperatureRangeC };
  });

  const summaries: Partial<Record<NasaPowerParameterId, ParameterSummary>> = {};
  for (const parameterId of args.request.parameters) {
    const values = daily.map(d => d.measurements[parameterId]).filter((m): m is DailyMeasurement => m !== undefined && m.value !== null).map(m => m.value as number);
    const dates = daily.filter(d => d.measurements[parameterId]?.value !== null && d.measurements[parameterId]?.value !== undefined).map(d => d.date);
    const requestedDayCount = days.length;
    summaries[parameterId] = { unit: NASA_POWER_PARAMETERS[parameterId].unit, requestedDayCount, validObservationCount: values.length, missingObservationCount: requestedDayCount - values.length, coverage: requestedDayCount ? values.length / requestedDayCount : 0, coveragePercent: requestedDayCount ? 100 * values.length / requestedDayCount : 0, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, firstAvailableDate: dates[0] ?? null, lastAvailableDate: dates.at(-1) ?? null };
    if (!paramData[parameterId]) warnings.push(`Requested parameter ${parameterId} was not present in NASA POWER response; all observations marked not_returned.`);
    if (summaries[parameterId].missingObservationCount > 0) warnings.push(`${parameterId} has ${summaries[parameterId].missingObservationCount} missing or invalid daily observations.`);
  }
  const annualPrecipitation: AnnualPrecipitation[] = [];
  if (args.request.parameters.includes("PRECTOTCORR")) {
    const firstYear = Number(args.request.start.slice(0,4)), lastYear = Number(args.request.end.slice(0,4));
    for (let year = firstYear; year <= lastYear; year++) {
      const expectedDays = new Date(Date.UTC(year + 1, 0, 1)).getTime() - new Date(Date.UTC(year, 0, 1)).getTime();
      const dayCount = expectedDays / 86400000;
      const yearDays = daily.filter(d => d.date.startsWith(`${year}-`));
      const values = yearDays.map(d => d.measurements.PRECTOTCORR?.value).filter((v): v is number => v !== null && v !== undefined);
      const complete = yearDays.length === dayCount && values.length === dayCount;
      const subtotal = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
      annualPrecipitation.push({ year, totalMm: complete ? subtotal : null, partialObservedSumMm: complete ? null : subtotal, validDays: values.length, expectedDays: dayCount, complete, status: complete ? "complete" : "incomplete_year_or_missing_days" });
    }
  }
  if (daily.length && daily[0].date !== args.request.start || daily.length && daily.at(-1)!.date !== args.request.end) warnings.push("Returned daily period differs from requested period.");
  const allAvailableDates = args.request.parameters.flatMap(parameterId => daily.filter(d => d.measurements[parameterId]?.value !== null).map(d => d.date)).sort();
  if (payload.header!.start && payload.header!.start !== args.request.start.replaceAll("-", "")) warnings.push(`NASA POWER response header start ${payload.header!.start} differs from requested ${args.request.start}.`);
  if (payload.header!.end && payload.header!.end !== args.request.end.replaceAll("-", "")) warnings.push(`NASA POWER response header end ${payload.header!.end} differs from requested ${args.request.end}.`);
  const inputParams = { latitude: String(args.request.latitude), longitude: String(args.request.longitude), parameters: args.request.parameters.join(","), community: "AG", start: args.request.start.replaceAll("-", ""), end: args.request.end.replaceAll("-", ""), format: "JSON", "time-standard": "UTC" };
  return {
    locationId: args.locationId, latitude: args.request.latitude, longitude: args.request.longitude, coordinatesApproximate: args.coordinatesApproximate,
    requestedCoordinate: { latitude: args.request.latitude, longitude: args.request.longitude }, providerResponseCoordinate: responseCoordinate,
    provider: "NASA POWER", endpoint: "https://power.larc.nasa.gov/api/temporal/daily/point", community: "AG", timeStandard: "UTC",
    requestedPeriod: { start: args.request.start, end: args.request.end }, actualObservationPeriod: { start: allAvailableDates[0] ?? null, end: allAvailableDates.at(-1) ?? null },
    parameters: args.request.parameters, daily, summaries, annualPrecipitation, warnings,
    provenance: { sourceId: "nasa-power-daily", provider: "NASA POWER", endpoint: "https://power.larc.nasa.gov/api/temporal/daily/point", sourceUrl: args.sourceUrl, retrievedAt: args.retrievedAt, requestParameters: inputParams, originalUnits: Object.fromEntries(args.request.parameters.map(p => [p, payload.parameters![p].units!])), outputUnits: Object.fromEntries(args.request.parameters.map(p => [p, NASA_POWER_PARAMETERS[p].unit])), processingMethod: "UTC daily point response; original numeric observations retained; fill sentinel mapped to null; summaries and complete-year precipitation derived without imputation", spatialResolution: args.sourceResolution ?? "Meteorology: 0.5° latitude × 0.625° longitude MERRA-2 grid; point request snaps to provider grid", temporalResolution: "Daily", qualityStatus: "needs_verification" }
  };
}
