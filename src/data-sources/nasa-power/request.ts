import { NASA_POWER_COMMUNITY, NASA_POWER_ENDPOINT, NASA_POWER_PARAMETERS, type NasaPowerParameterId } from "./config.js";

export interface DailyRequest { latitude: number; longitude: number; start: string; end: string; parameters?: NasaPowerParameterId[]; }
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export function validateDailyRequest(request: DailyRequest): Required<DailyRequest> {
  if (!Number.isFinite(request.latitude) || request.latitude < -90 || request.latitude > 90) throw new Error("Latitude must be a finite number in [-90, 90].");
  if (!Number.isFinite(request.longitude) || request.longitude < -180 || request.longitude > 180) throw new Error("Longitude must be a finite number in [-180, 180].");
  const checkDate = (value: string, name: string) => {
    if (!isoDate.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new Error(`${name} must be a valid YYYY-MM-DD date.`);
  };
  checkDate(request.start, "start"); checkDate(request.end, "end");
  if (request.start < "1981-01-01") throw new Error("Daily NASA POWER meteorological data begins 1981-01-01.");
  if (request.start > request.end) throw new Error("start must be on or before end.");
  const parameters = request.parameters ?? Object.keys(NASA_POWER_PARAMETERS) as NasaPowerParameterId[];
  if (!parameters.length || new Set(parameters).size !== parameters.length) throw new Error("Choose one or more unique NASA POWER parameter IDs.");
  for (const parameter of parameters) if (!(parameter in NASA_POWER_PARAMETERS)) throw new Error(`Unsupported NASA POWER parameter: ${parameter}`);
  if (parameters.length > 20) throw new Error("NASA POWER Daily Point API supports at most 20 parameters per request.");
  return { ...request, parameters };
}
export function buildDailyUrl(input: DailyRequest): URL {
  const request = validateDailyRequest(input);
  const url = new URL(NASA_POWER_ENDPOINT);
  const params = new URLSearchParams({
    parameters: request.parameters.join(","), community: NASA_POWER_COMMUNITY,
    longitude: String(request.longitude), latitude: String(request.latitude),
    start: request.start.replaceAll("-", ""), end: request.end.replaceAll("-", ""),
    format: "JSON", "time-standard": "UTC"
  });
  url.search = params.toString();
  return url;
}
