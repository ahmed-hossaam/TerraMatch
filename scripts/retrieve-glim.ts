import { readFile, mkdir, writeFile, rename, access } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { queryGlimSite } from "../src/data-sources/glim/client.js";
import { normalizeGlimRaw } from "../src/data-sources/glim/normalize.js";

const ids = (process.env.GLIM_SITE_IDS ?? "GKC,GKB,WDE,KHA,RTI").split(",").map(s => s.trim()).filter(Boolean);
const rawDir = process.env.GLIM_RAW_DIR ?? "data/raw/glim";
const sites = JSON.parse(await readFile(process.env.KNOWN_SITES_FILE ?? "data/processed/known-sites.json", "utf8")) as LocationRecord[];
const force = process.argv.includes("--force");
const retries = Number(process.env.GLIM_RETRIES ?? 2);
const timeoutMs = Number(process.env.GLIM_TIMEOUT_MS ?? 20000);
await mkdir(rawDir, { recursive: true });
async function atomicJson(path: string, data: unknown) { const tmp = `${path}.${process.pid ?? "p"}.tmp`; await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8"); await rename(tmp, path); }
const results: Array<Record<string, unknown>> = [], failures: Array<Record<string, unknown>> = [];
for (const id of ids) {
  const site = sites.find(item => item.id === id && item.recordType === "known_analog");
  if (!site) { failures.push({ locationId: id, reason: "known-site record not found" }); continue; }
  const path = `${rawDir}/${id}_GLiM.json`;
  try {
    let exists = true;
    try { await access(path); } catch { exists = false; }
    if (exists) {
      const existing = JSON.parse(await readFile(path, "utf8"));
      const norm = normalizeGlimRaw(existing);
      if (norm.locationId !== site.id || norm.requestedCoordinate.latitude !== site.latitude || norm.requestedCoordinate.longitude !== site.longitude || norm.coordinatesApproximate !== site.coordinatesApproximate) throw new Error("Existing raw GLiM file does not match this site's coordinates/source context; refusing overwrite.");
      if (!force) { results.push({ locationId: id, status: "reused_existing_raw", rawPath: path, featureCount: norm.lithologyEvidence.features.length, classificationStatus: norm.lithologyEvidence.status }); continue; }
    }
    const raw = await queryGlimSite({ id: site.id, latitude: site.latitude, longitude: site.longitude, coordinatesApproximate: site.coordinatesApproximate }, { retries, timeoutMs });
    const normalized = normalizeGlimRaw(raw);
    await atomicJson(path, raw);
    results.push({ locationId: id, status: "retrieved", rawPath: path, featureCount: normalized.lithologyEvidence.features.length, classificationStatus: normalized.lithologyEvidence.status, objectIds: normalized.lithologyEvidence.features.map(f => f.objectId) });
  } catch (error) { failures.push({ locationId: id, reason: error instanceof Error ? error.message : String(error), rawPath: path }); }
  await new Promise(resolve => setTimeout(resolve, 200));
}
const report = { generatedAt: new Date().toISOString(), provider: "GLiM ArcGIS Feature Service", layer: "GLiM_Niveau_I (FeatureServer/1)", requestedSiteIds: ids, successfulSiteCount: results.length, failedSiteCount: failures.length, sites: results, failures };
await atomicJson(`${rawDir}/retrieval-report.json`, report);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
