import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { normalizeCopernicusSample, type CopernicusRawSample } from "../src/data-sources/copernicus-dem/normalize.js";

const ids = (process.env.COPERNICUS_SITE_IDS ?? "GKC,GKB,WDE,KHA,RTI").split(",").map(s => s.trim()).filter(Boolean);
const rawDir = process.env.COPERNICUS_RAW_DIR ?? "data/raw/copernicus-dem";
const sites = JSON.parse(await readFile("data/processed/known-sites.json", "utf8")) as LocationRecord[];
const files = await readdir(rawDir).catch(() => [] as string[]);
const processed = [], sitesReport = [], failures = [];
for (const id of ids) {
  const site = sites.find(item => item.id === id && item.recordType === "known_analog");
  const path = `${rawDir}/${id}_GLO-30.json`;
  if (!site) { failures.push({ locationId: id, reason: "known-site record not found" }); continue; }
  if (!files.includes(`${id}_GLO-30.json`)) { failures.push({ locationId: id, reason: `raw extraction missing: ${path}` }); continue; }
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as CopernicusRawSample;
    const normalized = normalizeCopernicusSample(raw, site);
    processed.push(normalized);
    sitesReport.push({ locationId: id, status: normalized.elevationSampleM.value === null ? "missing_elevation" : "success", valueM: normalized.elevationSampleM.value, requestedCoordinate: normalized.requestedCoordinate, sampleCoordinate: normalized.providerResponseCoordinate, tileId: normalized.tileId, sourceUrl: normalized.sourceUrl });
  } catch (error) { failures.push({ locationId: id, reason: error instanceof Error ? error.message : String(error) }); }
}
await mkdir("data/processed/terrain", { recursive: true });
async function atomicJson(path: string, value: unknown) {
  const temporary = `${path}.${process.pid ?? "p"}.tmp`;
  await writeFile(temporary, JSON.stringify(value) + "\n", "utf8"); await rename(temporary, path);
}
await atomicJson("data/processed/terrain/elevation-samples.json", processed);
await atomicJson("data/processed/terrain/validation-report.json", { generatedAt: new Date().toISOString(), provider: "Copernicus DEM via AWS Public Dataset", productId: "COP-DEM_GLO-30-Public", productVersion: "Copernicus DEM 2021 release", requestedSiteIds: ids, successfulSiteCount: sitesReport.filter(item => item.status === "success").length, missingElevationCount: sitesReport.filter(item => item.status === "missing_elevation").length, failedSiteCount: failures.length, sites: sitesReport, failures });
console.log(JSON.stringify({ sites: sitesReport, failures }, null, 2));
if (failures.length) process.exitCode = 1;
