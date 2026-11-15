import { readFile, mkdir, writeFile, rename, access } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { retrieveCopernicusSample } from "../src/data-sources/copernicus-dem/retrieve.js";
import { normalizeCopernicusSample } from "../src/data-sources/copernicus-dem/normalize.js";

const ids = (process.env.COPERNICUS_SITE_IDS ?? "GKC,GKB,WDE,KHA,RTI").split(",").map(value => value.trim()).filter(Boolean);
const rawDir = process.env.COPERNICUS_RAW_DIR ?? "data/raw/copernicus-dem";
const known = JSON.parse(await readFile(process.env.KNOWN_SITES_FILE ?? "data/processed/known-sites.json", "utf8")) as LocationRecord[];
const force = process.argv.includes("--force");
const successes: Array<Record<string, unknown>> = [], failures: Array<Record<string, unknown>> = [];
await mkdir(rawDir, { recursive: true });
async function atomicJson(path: string, data: unknown) {
  const temp = `${path}.${process.pid ?? "p"}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8"); await rename(temp, path);
}
for (const id of ids) {
  const site = known.find(item => item.id === id && item.recordType === "known_analog");
  if (!site) { failures.push({ locationId: id, reason: "known-site record not found" }); continue; }
  const path = `${rawDir}/${id}_GLO-30.json`;
  try {
    let exists = true;
    try {
      await access(path);
    } catch { exists = false; }
    if (exists) {
      const existing = JSON.parse(await readFile(path, "utf8"));
      const valid = normalizeCopernicusSample(existing, site);
      if (!force) { successes.push({ locationId: id, status: "reused_existing_raw", rawPath: path, valueM: valid.elevationSampleM.value }); continue; }
    }
    const sample = await retrieveCopernicusSample({ id: site.id, latitude: site.latitude, longitude: site.longitude, coordinatesApproximate: site.coordinatesApproximate });
    await atomicJson(path, sample);
    const normalized = normalizeCopernicusSample(sample, site);
    successes.push({ locationId: id, status: "retrieved", rawPath: path, valueM: normalized.elevationSampleM.value, sampleCoordinate: normalized.providerResponseCoordinate, tileId: normalized.tileId });
  } catch (error) { failures.push({ locationId: id, reason: error instanceof Error ? error.message : String(error), rawPath: path }); }
}
const report = { generatedAt: new Date().toISOString(), provider: "Copernicus DEM via AWS Public Dataset", productId: "COP-DEM_GLO-30-Public", productVersion: "Copernicus DEM 2021 release", requestedSiteIds: ids, successfulSiteCount: successes.length, failedSiteCount: failures.length, sites: successes, failures };
await atomicJson(`${rawDir}/retrieval-report.json`, report);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
