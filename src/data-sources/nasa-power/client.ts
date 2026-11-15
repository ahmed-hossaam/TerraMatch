import { DEFAULT_PARAMETERS, type NasaPowerParameterId } from "./config.js";
import { makeCacheKey, NasaPowerStorage } from "./cache.js";
import { normalizeDailyResponse, type NormalizedClimateResult, type PowerResponse } from "./parser.js";
import { buildDailyUrl, validateDailyRequest, type DailyRequest } from "./request.js";

export interface RetrieveLocation extends DailyRequest { locationId: string; coordinatesApproximate: boolean | null; }
export interface ClientOptions {
  storage?: NasaPowerStorage; fetchImpl?: typeof fetch; timeoutMs?: number; maxAttempts?: number;
  retryDelayMs?: number; now?: () => Date;
}
export interface RetrievalResult { normalized: NormalizedClimateResult; rawPath: string; metadataPath: string; cacheKey: string; cacheHit: boolean; }
export class NasaPowerHttpError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = "NasaPowerHttpError"; } }

export class NasaPowerClient {
  private readonly storage: NasaPowerStorage;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly now: () => Date;
  private readonly inFlight = new Map<string, Promise<{ responseText: string; retrievedAt: string; cacheHit: boolean }>>();
  constructor(options: ClientOptions = {}) {
    this.storage = options.storage ?? new NasaPowerStorage(); this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 45_000; this.maxAttempts = options.maxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 800; this.now = options.now ?? (() => new Date());
  }
  async retrieve(location: RetrieveLocation): Promise<RetrievalResult> {
    const request = validateDailyRequest({ latitude: location.latitude, longitude: location.longitude, start: location.start, end: location.end, parameters: location.parameters ?? DEFAULT_PARAMETERS as NasaPowerParameterId[] });
    if (!location.locationId.trim()) throw new Error("locationId is required to link climate data to a known site.");
    const cacheKey = makeCacheKey(request);
    let responseTask = this.inFlight.get(cacheKey);
    if (!responseTask) {
      responseTask = this.loadResponse(request, cacheKey);
      this.inFlight.set(cacheKey, responseTask);
    }
    try {
      const response = await responseTask;
      return this.materialize(location, request, cacheKey, response);
    } finally { if (this.inFlight.get(cacheKey) === responseTask) this.inFlight.delete(cacheKey); }
  }
  private async loadResponse(request: Required<DailyRequest>, cacheKey: string): Promise<{ responseText: string; retrievedAt: string; cacheHit: boolean }> {
    const cached = await this.storage.readCache(cacheKey);
    if (cached) {
      try {
        this.validateBody(cached.responseText, request, buildDailyUrl(request).toString(), cached.retrievedAt);
        if (!containsAllRequestedSeries(cached.responseText, request.parameters)) throw new Error("Cached response is incomplete.");
        return { ...cached, cacheHit: true };
      }
      catch { /* A corrupted or incomplete cache entry is treated as a miss and replaced after a successful request. */ }
    }
    const sourceUrl = buildDailyUrl(request).toString();
    const responseText = await this.fetchText(sourceUrl);
    const retrievedAt = this.now().toISOString();
    this.validateBody(responseText, request, sourceUrl, retrievedAt);
    if (containsAllRequestedSeries(responseText, request.parameters)) await this.storage.writeCache({ cacheKey, responseText, retrievedAt });
    return { responseText, retrievedAt, cacheHit: false };
  }
  private validateBody(responseText: string, request: Required<DailyRequest>, sourceUrl: string, retrievedAt: string) {
    let payload: PowerResponse;
    try { payload = JSON.parse(responseText) as PowerResponse; }
    catch { throw new Error("NASA POWER returned malformed JSON; response was not cached."); }
    normalizeDailyResponse({ payload, request, locationId: "cache-validation", coordinatesApproximate: null, retrievedAt, sourceUrl });
  }
  private async materialize(location: RetrieveLocation, request: Required<DailyRequest>, cacheKey: string, response: { responseText: string; retrievedAt: string; cacheHit: boolean }): Promise<RetrievalResult> {
    const sourceUrl = buildDailyUrl(request).toString();
    const normalized = normalizeDailyResponse({ payload: JSON.parse(response.responseText), request, locationId: location.locationId, coordinatesApproximate: location.coordinatesApproximate, retrievedAt: response.retrievedAt, sourceUrl });
    const raw = await this.storage.preserveRaw({ responseText: response.responseText, cacheKey, metadata: this.metadata(location, request, sourceUrl, response.retrievedAt) });
    return { normalized, ...raw, cacheKey, cacheHit: response.cacheHit };
  }
  private metadata(location: RetrieveLocation, request: Required<DailyRequest>, sourceUrl: string, retrievedAt: string) {
    return { sourceId: "nasa-power-daily", provider: "NASA POWER", endpoint: "https://power.larc.nasa.gov/api/temporal/daily/point", sourceUrl, retrievedAt, requestParameters: { latitude: String(request.latitude), longitude: String(request.longitude), parameters: request.parameters.join(","), community: "AG", start: request.start.replaceAll("-", ""), end: request.end.replaceAll("-", ""), format: "JSON", "time-standard": "UTC" }, locationId: location.locationId, coordinatesApproximate: location.coordinatesApproximate };
  }
  private async fetchText(url: string): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs), headers: { Accept: "application/json" } });
        const body = await response.text();
        if (!response.ok) {
          const error = new NasaPowerHttpError(`NASA POWER HTTP ${response.status}: ${extractApiMessage(body)}`, response.status);
          if (response.status < 500 && response.status !== 429) throw error;
          lastError = error;
        } else return body;
      } catch (error) {
        if (error instanceof NasaPowerHttpError && error.status < 500 && error.status !== 429) throw error;
        lastError = error;
      }
      if (attempt < this.maxAttempts) await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * attempt));
    }
    throw new Error(`NASA POWER request failed after ${this.maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}
function containsAllRequestedSeries(responseText: string, parameters: NasaPowerParameterId[]): boolean {
  try {
    const payload = JSON.parse(responseText) as PowerResponse;
    return parameters.every(parameter => payload.properties?.parameter && Object.hasOwn(payload.properties.parameter, parameter));
  } catch { return false; }
}
function extractApiMessage(body: string): string {
  try { const parsed = JSON.parse(body); const messages = parsed.messages ?? parsed.message ?? parsed.error; return typeof messages === "string" ? messages : Array.isArray(messages) ? messages.join("; ") : body.slice(0, 300); }
  catch { return body.slice(0, 300); }
}
