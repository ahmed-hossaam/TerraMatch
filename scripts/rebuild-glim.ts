import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { normalizeGlimRaw } from "../src/data-sources/glim/normalize.js";

const ids = (process.env.GLIM_SITE_IDS ?? "GKC,GKB,WDE,KHA,RTI").split(",").map(s => s.trim()).filter(Boolean);
const rawDir = process.env.GLIM_RAW_DIR ?? "data/raw/glim";
const sites = JSON.parse(await readFile(process.env.KNOWN_SITES_FILE ?? "data/processed/known-sites.json", "utf8")) as LocationRecord[];
const files = await readdir(rawDir).catch(() => [] as string[]);
const records = [], outcomes: Array<Record<string, unknown>> = [], failures: Array<Record<string, unknown>> = [];
for (const id of ids) {
  const site = sites.find(item => item.id === id && item.recordType === "known_analog");
  const path = `${rawDir}/${id}_GLiM.json`;
  if (!site) { failures.push({ locationId: id, reason: "known-site record not found" }); continue; }
  if (!files.includes(`${id}_GLiM.json`)) { failures.push({ locationId: id, reason: `raw response missing: ${path}` }); continue; }
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    const result = normalizeGlimRaw(raw);
    if (result.requestedCoordinate.latitude !== site.latitude || result.requestedCoordinate.longitude !== site.longitude || result.coordinatesApproximate !== site.coordinatesApproximate) throw new Error("Raw response coordinate or approximate-coordinate flag does not match known site.");
    records.push(result);
    outcomes.push({ locationId: id, status: result.lithologyEvidence.status, featureCount: result.lithologyEvidence.features.length, objectIds: result.lithologyEvidence.features.map(f => f.objectId), approximateCoordinates: result.coordinatesApproximate });
  } catch (error) { failures.push({ locationId: id, reason: error instanceof Error ? error.message : String(error) }); }
}
await mkdir("data/processed/geology", { recursive: true });
async function atomicJson(path: string, value: unknown) { const tmp = `${path}.${process.pid ?? "p"}.tmp`; await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(tmp, path); }
const missingCount = outcomes.filter(item => ["no_feature", "incomplete", "no_data_class"].includes(String(item.status))).length;
const report = { generatedAt: new Date().toISOString(), provider: "GLiM ArcGIS Feature Service", requestedSiteIds: ids, normalizedRecordCount: records.length, successfulMappedSiteCount: outcomes.filter(item => item.status === "mapped").length, ambiguousSiteCount: outcomes.filter(item => item.status === "ambiguous").length, missingOrNoDataSiteCount: missingCount, failedSiteCount: failures.length, sites: outcomes, failures };
await atomicJson("data/processed/geology/known-sites-glim.json", records);
await atomicJson("data/processed/geology/validation-report.json", report);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
