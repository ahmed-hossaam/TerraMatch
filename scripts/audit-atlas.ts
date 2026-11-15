import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { normalizeAtlasSite } from "../src/normalization/atlas.js";
import { candidateFixtures } from "../src/normalization/fixtures.js";
import { validateRecords } from "../src/validation/records.js";

const input = "أطلس المواقع المشابهة للمريخ (JSON).json";
const raw = JSON.parse(await readFile(input, "utf8"));
const sites: any[] = raw.sites;
const known = sites.map(normalizeAtlasSite);
const duplicates = sites.map(s => s.id).filter((id: string, i: number, ids: string[]) => ids.indexOf(id) !== i);
const coordinateInvalid = sites.filter(s => !Number.isFinite(s.location?.lat) || s.location.lat < -90 || s.location.lat > 90 || !Number.isFinite(s.location?.lon) || s.location.lon < -180 || s.location.lon > 180).map(s => s.id);
const missingCoordinates = sites.filter(s => s.location?.lat == null || s.location?.lon == null).map(s => s.id);
const approximateCoordinates = sites.filter(s => s.location?.coords_approximate === true).map(s => s.id);
const climateFields = ["t_mean_C", "diurnal_range_C", "t_max_monthly_C", "t_min_monthly_C", "precip_mm_yr", "rh_pct", "solar_kwh_m2_day", "uv_index", "wind_ms"];
const missingClimate = Object.fromEntries(climateFields.map(field => [field, sites.filter(s => s.climate_nasa_power?.[field] == null).map(s => s.id)]));
const missingGeology = Object.fromEntries(["formation", "rocks", "minerals"].map(field => [field, sites.filter(s => { const v=s.geology?.[field]; return v == null || v === "" || Array.isArray(v) && v.length === 0; }).map(s => s.id)]));
const missingFormalLithologyClassification = sites.filter(s => !s.geology?.lithology_classification).map(s => s.id);
const weakMineralSiteIds = sites.filter(s => ["مصر", "الصين"].includes(s.country)).map(s => s.id);
const mineralWarnings = [{ sourceNote: "Some mineral descriptions for Egyptian and Gobi sites are partly inferred from general rock composition.", siteIds: weakMineralSiteIds }];
const rainfallWarnings = [{ id: "ATA", field: "precip_mm_yr", atlasValue: sites.find(s => s.id === "ATA")?.climate_nasa_power?.precip_mm_yr ?? null, note: "Atlas notes NASA POWER 7.3 mm is higher than field measurement (<2 mm)." }];
const manualReview = [...new Set([...approximateCoordinates, ...weakMineralSiteIds, "ATA", ...sites.filter(s => !s.geology?.formation || !s.geology?.rocks || !s.geology?.minerals?.length).map(s => s.id)])];
const normalizedErrors = validateRecords([...known, ...candidateFixtures]);
const report = { generatedAt: new Date().toISOString(), sourceFile: input, sourceSiteCount: sites.length, declaredSiteCount: raw.site_count, validRecordCount: sites.length - coordinateInvalid.length - duplicates.length, invalidRecordCount: coordinateInvalid.length + duplicates.length, duplicateIds: duplicates, invalidCoordinates: coordinateInvalid, missingCoordinates, approximateCoordinateIds: approximateCoordinates, approximateCoordinateCount: approximateCoordinates.length, missingClimateFields: missingClimate, missingGeologicalFields: missingGeology, missingFormalLithologyClassification, mineralEvidenceWarnings: mineralWarnings, rainfallDiscrepancies: rainfallWarnings, sourceAtlasNotes: raw.notes ?? [], recordsRequiringManualReview: manualReview, normalizedRecordValidationErrors: normalizedErrors };
await mkdir("data/processed", { recursive: true });
await mkdir("data/benchmarks", { recursive: true });
async function writeJsonAtomic(path: string, value: unknown) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temporary, path);
}
await writeJsonAtomic("data/processed/known-sites.json", known);
await writeJsonAtomic("data/processed/candidate-points.json", candidateFixtures);
await writeJsonAtomic("data/benchmarks/benchmark-sites.json", { manifestVersion: 1, referenceSource: input, blindEvaluationStatus: "not_run", sites: sites.map(s => ({ id: s.id, referenceLabel: s.name_en ?? s.name_ar })) });
await writeJsonAtomic("data/processed/atlas-audit.json", report);
console.log(JSON.stringify(report, null, 2));
