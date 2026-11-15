import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { NASA_POWER_PARAMETERS } from "../src/data-sources/nasa-power/config.js";
import { NasaPowerClient } from "../src/data-sources/nasa-power/client.js";
import { makeCacheKey, NasaPowerStorage } from "../src/data-sources/nasa-power/cache.js";
import { normalizeDailyResponse } from "../src/data-sources/nasa-power/parser.js";
import { buildDailyUrl, validateDailyRequest } from "../src/data-sources/nasa-power/request.js";

const params = Object.keys(NASA_POWER_PARAMETERS) as (keyof typeof NASA_POWER_PARAMETERS)[];
function response(start: string, values: Record<string, Record<string, unknown>>, overrides: Record<string, unknown> = {}) {
  const date = start.replaceAll("-", "");
  return {
    type: "Feature", geometry: { type: "Point", coordinates: [26.25, 22.8125, 432.1] }, header: { fill_value: -999, start: date, end: date, time_standard: "UTC" },
    parameters: Object.fromEntries(params.map(id => [id, { units: NASA_POWER_PARAMETERS[id].unit.replace("°C", "C").replace("²", "^2"), longname: NASA_POWER_PARAMETERS[id].description }])),
    properties: { parameter: Object.fromEntries(params.map(id => [id, values[id] ?? { [date]: 1 }])) }, messages: [], ...overrides
  };
}
const base = { latitude: 22.8, longitude: 26.2, start: "2020-01-01", end: "2020-01-01", parameters: params };
function normalize(payload: unknown, request = validateDailyRequest(base), extra: Record<string, unknown> = {}) {
  return normalizeDailyResponse({ payload, request, locationId: "GKC", coordinatesApproximate: true, retrievedAt: "2026-11-14T00:00:00.000Z", sourceUrl: "https://power.larc.nasa.gov/example", ...extra });
}
function temporaryStorage() {
  const root = `data/nasa-power-test-${process.pid ?? 1}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { root, storage: new NasaPowerStorage(`${root}/cache`, `${root}/raw`) };
}
async function removeTemporaryRoot(root: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await rm(root, { recursive: true, force: true }); return; }
    catch (error) { if (attempt === 3) throw error; await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1))); }
  }
}

describe("NASA POWER daily adapter", () => {
  it("builds the documented Daily Point URL and query options", () => {
    const url = buildDailyUrl(base);
    assert.equal(url.origin + url.pathname, "https://power.larc.nasa.gov/api/temporal/daily/point");
    assert.equal(url.searchParams.get("parameters"), params.join(","));
    assert.equal(url.searchParams.get("community"), "AG");
    assert.equal(url.searchParams.get("latitude"), "22.8");
    assert.equal(url.searchParams.get("longitude"), "26.2");
    assert.equal(url.searchParams.get("start"), "20200101");
    assert.equal(url.searchParams.get("end"), "20200101");
    assert.equal(url.searchParams.get("time-standard"), "UTC");
    assert.equal(url.searchParams.get("format"), "JSON");
  });
  it("rejects invalid coordinates, dates, ranges, unsupported parameters, and pre-1981 dates", () => {
    assert.throws(() => validateDailyRequest({ ...base, latitude: 91 }), /Latitude/);
    assert.throws(() => validateDailyRequest({ ...base, longitude: -181 }), /Longitude/);
    assert.throws(() => validateDailyRequest({ ...base, start: "2020-02-30" }), /valid YYYY-MM-DD/);
    assert.throws(() => validateDailyRequest({ ...base, start: "2021-01-01", end: "2020-01-01" }), /on or before/);
    assert.throws(() => validateDailyRequest({ ...base, start: "1980-12-31" }), /begins 1981/);
    assert.throws(() => validateDailyRequest({ ...base, parameters: ["UV_INDEX" as never] }), /Unsupported/);
  });
  it("parses valid values, converts the fill sentinel to null, and preserves units and provenance", () => {
    const day = "20200101";
    const payload = response("2020-01-01", {
      T2M: { [day]: 4.25 }, T2M_MAX: { [day]: 9 }, T2M_MIN: { [day]: 2 },
      RH2M: { [day]: -999 }, PRECTOTCORR: { [day]: 0 }, WS10M: { [day]: 3.4 }, ALLSKY_SFC_SW_DWN: { [day]: 13.2 }
    });
    const result = normalize(payload);
    assert.equal(result.daily[0].measurements.T2M?.value, 4.25);
    assert.equal(result.daily[0].measurements.RH2M?.value, null);
    assert.equal(result.daily[0].measurements.RH2M?.qualityStatus, "missing_sentinel");
    assert.equal(result.daily[0].measurements.PRECTOTCORR?.value, 0);
    assert.equal(result.daily[0].measurements.ALLSKY_SFC_SW_DWN?.unit, "MJ/m²/day");
    assert.equal(result.provenance.originalUnits.ALLSKY_SFC_SW_DWN, "MJ/m^2/day");
    assert.equal(result.coordinatesApproximate, true);
    assert.equal(result.locationId, "GKC");
    assert.deepEqual(result.requestedCoordinate, { latitude: 22.8, longitude: 26.2 });
    assert.deepEqual(result.providerResponseCoordinate, { longitude: 26.25, latitude: 22.8125, elevationM: 432.1 });
    assert.equal(result.daily[0].measurements.RH2M?.rawValue, -999);
    assert.equal(result.daily[0].temperatureRangeC?.value, 7);
    const utf8 = new TextEncoder().encode(JSON.stringify(result));
    const unitBytes = new TextEncoder().encode("MJ/m²/day");
    assert.equal(utf8.some((_, index) => unitBytes.every((byte, offset) => utf8[index + offset] === byte)), true);
  });
  it("does not derive temperature range when an input is missing and marks absent days", () => {
    const day = "20200101";
    const payload = response("2020-01-01", { T2M_MAX: { [day]: 5 }, T2M_MIN: { [day]: -999 } });
    const result = normalize(payload, validateDailyRequest({ ...base, end: "2020-01-02" }));
    assert.equal(result.daily[0].temperatureRangeC?.value, null);
    assert.equal(result.daily[0].temperatureRangeC?.qualityStatus, "missing_sentinel");
    assert.equal(result.daily[1].measurements.T2M?.qualityStatus, "not_returned");
    assert.equal(result.summaries.T2M?.validObservationCount, 1);
    assert.equal(result.summaries.T2M?.missingObservationCount, 1);
    assert.equal(result.summaries.T2M?.coverage, 0.5);
    assert.equal(result.summaries.T2M?.coveragePercent, 50);
  });
  it("rejects malformed response structures and unit mismatches", () => {
    assert.throws(() => normalize({ header: {} }), /properties.parameter/);
    const wrongUnits = response("2020-01-01", {});
    (wrongUnits as any).parameters.T2M.units = "K";
    assert.throws(() => normalize(wrongUnits), /unit mismatch for T2M/);
  });
  it("handles absent or incomplete geometry safely and preserves available elevation", () => {
    const absent = response("2020-01-01", {}, { geometry: undefined });
    const noGeometry = normalize(absent);
    assert.deepEqual(noGeometry.providerResponseCoordinate, { longitude: null, latitude: null, elevationM: null });
    const twoDimensional = response("2020-01-01", {}, { geometry: { type: "Point", coordinates: [26, 22] } });
    assert.deepEqual(normalize(twoDimensional).providerResponseCoordinate, { longitude: 26, latitude: 22, elevationM: null });
  });
  it("reports complete annual precipitation only for every day in a full year", () => {
    const values = Object.fromEntries(Array.from({ length: 365 }, (_, index) => {
      const d = new Date(Date.UTC(2021, 0, index + 1));
      return [`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`, index === 12 ? -999 : 2];
    }));
    const period = validateDailyRequest({ latitude: 1, longitude: 1, start: "2021-01-01", end: "2021-12-31", parameters: ["PRECTOTCORR"] });
    const incomplete = normalize(response("2021-01-01", { PRECTOTCORR: values }), period).annualPrecipitation[0];
    assert.equal(incomplete.totalMm, null);
    assert.equal(incomplete.partialObservedSumMm, 728);
    assert.equal(incomplete.complete, false);
    const completeValues = Object.fromEntries(Object.entries(values).map(([day, value]) => [day, 2]));
    const complete = normalize(response("2021-01-01", { PRECTOTCORR: completeValues }), period).annualPrecipitation[0];
    assert.equal(complete.totalMm, 730);
    assert.equal(complete.partialObservedSumMm, null);
  });
  it("generates cache keys deterministically and changes them when request inputs change", () => {
    assert.equal(makeCacheKey(base), makeCacheKey({ ...base }));
    assert.notEqual(makeCacheKey(base), makeCacheKey({ ...base, end: "2020-01-02" }));
    assert.notEqual(makeCacheKey(base), makeCacheKey({ ...base, latitude: 22.81 }));
  });
  it("uses cache hits and deduplicates concurrent identical requests while preserving each site link", async () => {
    const { root, storage } = temporaryStorage(); await mkdir(root, { recursive: true });
    let calls = 0;
    const rawText = JSON.stringify(response("2020-01-01", {}));
    const client = new NasaPowerClient({ storage, maxAttempts: 1, now: () => new Date("2026-11-14T01:00:00Z"), fetchImpl: async () => { calls++; await new Promise(r => setTimeout(r, 5)); return new Response(rawText, { status: 200 }); } });
    try {
      const [a, b] = await Promise.all([client.retrieve({ ...base, locationId: "SITE-A", coordinatesApproximate: true }), client.retrieve({ ...base, locationId: "SITE-B", coordinatesApproximate: false })]);
      assert.equal(calls, 1);
      assert.equal(a.normalized.locationId, "SITE-A"); assert.equal(b.normalized.locationId, "SITE-B");
      assert.equal(a.normalized.coordinatesApproximate, true); assert.equal(b.normalized.coordinatesApproximate, false);
      assert.equal(a.cacheHit, false); assert.equal(b.cacheHit, false);
      const again = await client.retrieve({ ...base, locationId: "SITE-A", coordinatesApproximate: true });
      assert.equal(calls, 1); assert.equal(again.cacheHit, true);
      const exactRaw = await readFile(a.rawPath, "utf8");
      assert.equal(exactRaw, rawText);
      assert.equal(JSON.parse(await readFile(a.metadataPath, "utf8")).locationId, "SITE-A");
    } finally { await removeTemporaryRoot(root); }
  });
  it("does not cache failed HTTP or invalid JSON responses", async () => {
    const { root, storage } = temporaryStorage(); await mkdir(root, { recursive: true });
    const client = new NasaPowerClient({ storage, maxAttempts: 1, fetchImpl: async () => new Response("service down", { status: 503 }) });
    const request = { ...base, locationId: "FAIL", coordinatesApproximate: null };
    try {
      await assert.rejects(() => client.retrieve(request), /HTTP 503/);
      assert.equal(await storage.readCache(makeCacheKey(base)), null);
      const invalidClient = new NasaPowerClient({ storage, maxAttempts: 1, fetchImpl: async () => new Response("{broken", { status: 200 }) });
      await assert.rejects(() => invalidClient.retrieve(request), /malformed JSON/);
      assert.equal(await storage.readCache(makeCacheKey(base)), null);
    } finally { await removeTemporaryRoot(root); }
  });
  it("preserves missing-parameter responses as partial data without caching them", async () => {
    const { root, storage } = temporaryStorage(); await mkdir(root, { recursive: true });
    const payload = response("2020-01-01", {});
    delete (payload.properties as any).parameter.RH2M;
    let calls = 0;
    const client = new NasaPowerClient({ storage, maxAttempts: 1, fetchImpl: async () => { calls++; return new Response(JSON.stringify(payload), { status: 200 }); } });
    try {
      const result = await client.retrieve({ ...base, locationId: "PARTIAL", coordinatesApproximate: null });
      assert.equal(result.normalized.summaries.RH2M?.validObservationCount, 0);
      assert.equal(result.normalized.summaries.RH2M?.missingObservationCount, 1);
      assert.equal(result.normalized.warnings.some(w => w.includes("RH2M was not present")), true);
      assert.equal(await storage.readCache(result.cacheKey), null);
      await client.retrieve({ ...base, locationId: "PARTIAL", coordinatesApproximate: null });
      assert.equal(calls, 2);
    } finally { await removeTemporaryRoot(root); }
  });
  it("retries a temporary server failure and then accepts a valid response", async () => {
    const { root, storage } = temporaryStorage(); await mkdir(root, { recursive: true });
    let calls = 0;
    const client = new NasaPowerClient({ storage, maxAttempts: 2, retryDelayMs: 0, fetchImpl: async () => ++calls === 1 ? new Response("temporary", { status: 503 }) : new Response(JSON.stringify(response("2020-01-01", {})), { status: 200 }) });
    try {
      const result = await client.retrieve({ ...base, locationId: "RETRY", coordinatesApproximate: null });
      assert.equal(calls, 2); assert.equal(result.normalized.locationId, "RETRY");
    } finally { await removeTemporaryRoot(root); }
  });
});
