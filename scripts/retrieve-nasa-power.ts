import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { DEFAULT_OBSERVATION_PERIOD, DEFAULT_PARAMETERS, type NasaPowerParameterId } from "../src/data-sources/nasa-power/config.js";
import { NasaPowerClient } from "../src/data-sources/nasa-power/client.js";
import { validateDailyRequest } from "../src/data-sources/nasa-power/request.js";

const requestedIds = (process.env.NASA_POWER_SITE_IDS ?? "GKC,GKB,WDE,KHA,RTI").split(",").map(s => s.trim()).filter(Boolean);
const start = process.env.NASA_POWER_START ?? DEFAULT_OBSERVATION_PERIOD.start;
const end = process.env.NASA_POWER_END ?? DEFAULT_OBSERVATION_PERIOD.end;
const parameters = process.env.NASA_POWER_PARAMETERS ? process.env.NASA_POWER_PARAMETERS.split(",").map(s => s.trim()) as NasaPowerParameterId[] : DEFAULT_PARAMETERS;
validateDailyRequest({ latitude: 0, longitude: 0, start, end, parameters });
const knownSites = JSON.parse(await readFile("data/processed/known-sites.json", "utf8")) as LocationRecord[];
const sites = requestedIds.map(id => {
  const record = knownSites.find(site => site.id === id && site.recordType === "known_analog");
  if (!record) throw new Error(`Known-site record ${id} was not found in data/processed/known-sites.json.`);
  if (record.latitude === null || record.longitude === null) throw new Error(`Known-site record ${id} has no usable coordinates.`);
  return record;
});
const client = new NasaPowerClient();
const records = [], failures: { locationId: string; message: string }[] = [];
for (const site of sites) {
  try {
    const result = await client.retrieve({ locationId: site.id, latitude: site.latitude!, longitude: site.longitude!, coordinatesApproximate: site.coordinatesApproximate, start, end, parameters });
    records.push(result.normalized);
    console.log(`${site.id}: ${result.cacheHit ? "cache hit" : "retrieved"}; ${result.normalized.daily.length} dates; ${result.rawPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ locationId: site.id, message }); console.error(`${site.id}: failed: ${message}`);
  }
}
await mkdir("data/processed/climate", { recursive: true });
async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${process.pid ?? "p"}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, path);
}
await atomicJson("data/processed/climate/known-sites-daily.json", records);
await atomicJson("data/processed/climate/retrieval-report.json", { generatedAt: new Date().toISOString(), provider: "NASA POWER", requestedSiteIds: requestedIds, successfulSiteCount: records.length, failedSiteCount: failures.length, requestedPeriod: { start, end }, parameters, failures });
if (failures.length) process.exitCode = 1;
