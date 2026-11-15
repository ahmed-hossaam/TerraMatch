import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { normalizeDailyResponse } from "../src/data-sources/nasa-power/parser.js";

const siteIds = (process.env.NASA_POWER_SITE_IDS ?? "GKC,RTI,GKB,WDE,KHA").split(",").map(s => s.trim()).filter(Boolean);
const rawDirectory = process.env.NASA_POWER_RAW_DIR ?? "data/raw/nasa-power";
const knownSites = JSON.parse(await readFile("data/processed/known-sites.json", "utf8")) as LocationRecord[];
const entries = await readdir(rawDirectory);
const results = [], failures: { locationId: string; reason: string }[] = [], reportSites = [];
for (const id of siteIds) {
  const known = knownSites.find(site => site.id === id && site.recordType === "known_analog");
  if (!known || known.latitude === null || known.longitude === null) { failures.push({ locationId: id, reason: "No normalized known-site record or coordinates." }); continue; }
  const metadataFiles = entries.filter(name => name.startsWith(`${id}_`) && name.endsWith(".meta.json"));
  let loaded = false;
  for (const metaFile of metadataFiles) {
    try {
      const metadata = JSON.parse(await readFile(`${rawDirectory}/${metaFile}`, "utf8"));
      const parameters = metadata.requestParameters;
      if (parameters.start !== "20010101" || parameters.end !== "20201231" || !String(parameters.parameters).split(",").includes("T2M")) continue;
      const responsePath = `${rawDirectory}/${metaFile.replace(/\.meta\.json$/, ".json")}`;
      const responseText = await readFile(responsePath, "utf8");
      const requestedLatitude = Number(parameters.latitude), requestedLongitude = Number(parameters.longitude);
      if (requestedLatitude !== known.latitude || requestedLongitude !== known.longitude) throw new Error("Raw response request coordinates do not match the normalized known-site record.");
      const normalized = normalizeDailyResponse({ payload: JSON.parse(responseText), request: { latitude: requestedLatitude, longitude: requestedLongitude, start: "2001-01-01", end: "2020-12-31", parameters: String(parameters.parameters).split(",") as any }, locationId: id, coordinatesApproximate: known.coordinatesApproximate, retrievedAt: metadata.retrievedAt, sourceUrl: metadata.sourceUrl });
      results.push(normalized);
      reportSites.push({ locationId: id, status: "success", rawResponse: responsePath, retrievedAt: metadata.retrievedAt, requestedPeriod: normalized.requestedPeriod, actualObservationPeriod: normalized.actualObservationPeriod, requestedCoordinate: normalized.requestedCoordinate, providerResponseCoordinate: normalized.providerResponseCoordinate, coordinatesApproximate: normalized.coordinatesApproximate, parameterCoveragePercent: Object.fromEntries(Object.entries(normalized.summaries).map(([parameter, summary]) => [parameter, summary?.coveragePercent])) });
      loaded = true; break;
    } catch (error) { /* try another matching response for this site before reporting failure */ }
  }
  if (!loaded) failures.push({ locationId: id, reason: metadataFiles.length ? "No matching valid raw response and sidecar passed validation." : "No raw NASA POWER response file exists." });
}
await mkdir("data/processed/climate", { recursive: true });
async function atomicJson(path: string, value: unknown) {
  const temporary = `${path}.${process.pid ?? "p"}.tmp`;
  await writeFile(temporary, JSON.stringify(value) + "\n", "utf8");
  await rename(temporary, path);
}
await atomicJson("data/processed/climate/known-sites-daily.json", results);
await atomicJson("data/processed/climate/retrieval-report.json", { generatedAt: new Date().toISOString(), provider: "NASA POWER", mode: "validated existing raw responses; no network requests", requestedSiteIds: siteIds, successfulSiteCount: results.length, failedSiteCount: failures.length, requestedPeriod: { start: "2001-01-01", end: "2020-12-31" }, parameters: results[0]?.parameters ?? [], sites: reportSites, failures });
console.log(JSON.stringify({ successfulSiteCount: results.length, failedSiteCount: failures.length, sites: reportSites.map(s => s.locationId), failures }, null, 2));
if (failures.length) process.exitCode = 1;
