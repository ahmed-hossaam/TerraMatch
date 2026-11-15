import { readFile, mkdir, writeFile, rename, access } from "node:fs/promises";
import type { LocationRecord, QualityStatus } from "../src/types/location.js";
import { validateRecords } from "../src/validation/records.js";
import { applySupplementaryEvidence } from "../src/normalization/supplementary-evidence.js";

const base = JSON.parse(await readFile("data/processed/known-sites.json", "utf8")) as LocationRecord[];
const review = JSON.parse(await readFile("data/benchmarks/supplementary-site-review.json", "utf8"));
const missingFactors = ["NASA POWER climate", "Copernicus DEM elevation", "GLiM lithology", "site-specific mineral evidence", "slope and roughness", "quantitative sediment/regolith properties"];
function measurement(unit: string, id: string, status: QualityStatus = "missing") {
  return { value: null, unit, sourceId: id, qualityStatus: status, processingMethod: "Not retrieved; preserved as null", observationPeriod: null };
}
function makeRecord(item: any): LocationRecord {
  const sourceId = `supplementary-reference-${item.id.toLowerCase()}`;
  const source = item.sources.map((ref: any) => `${ref.citation} (${ref.url})`).join("; ");
  return {
    id: item.id, recordType: "known_analog", planet: "Earth", latitude: item.latitude, longitude: item.longitude,
    coordinatesApproximate: item.coordinatesApproximate, country: item.country, regionName: item.name,
    discoveryMethod: "M06 curated supplementary reference; distinct from original 26-site atlas",
    elevationMeanM: measurement("m", sourceId), elevationSampleM: measurement("m", sourceId),
    climate: { observationPeriod: null, meanTemperatureC: measurement("°C", sourceId), meanDailyTemperatureRangeC: measurement("°C", sourceId), meanHumidityPct: measurement("%", sourceId), annualPrecipitationMm: measurement("mm/year", sourceId), meanWindSpeedMs: measurement("m/s", sourceId), meanSolarRadiation: measurement("MJ/m²/day", sourceId), missingDays: null, validDays: null, coverage: null },
    terrain: { elevationMinM: measurement("m", sourceId), elevationMaxM: measurement("m", sourceId), slopeMeanDeg: measurement("degrees", sourceId), slopeP95Deg: measurement("degrees", sourceId), roughness: measurement("metric undefined", sourceId), rasterResolutionM: null, sourceId: null, qualityStatus: "missing" },
    geology: { lithology: { classification: null, sourceId, qualityStatus: "missing" }, minerals: [], formationDescription: item.supportedClaims.join(" "), rockDescription: null, references: item.sources.map((ref: any) => ({ label: ref.citation, url: ref.url })), evidenceQuality: "needs_verification" },
    dataQuality: { coverage: null, confidence: null, missingFactors: [...missingFactors], warnings: [...item.limitations, item.mineralEvidence], validationErrors: [], qualityNotes: [`Review decision: ${item.decision}; spatial granularity: ${item.granularity}`, "Field evidence classes: published coordinate (derived DMS conversion where noted, approximate); geological text is descriptive publication context; climate, elevation, GLiM, and mineral measurements are missing/not retrieved."] },
    provenance: [{ sourceId, provider: "Published research review", endpointOrDataset: "Supplementary site evidence review", sourceUrl: item.sources[0]?.url ?? null, retrievedAt: null, requestParameters: null, originalUnit: null, outputUnit: null, processingMethod: "Identity, coordinate granularity, and supported claims curated from cited publications; no measurements copied into climate/terrain fields", spatialResolution: item.granularity, temporalResolution: null, qualityStatus: "needs_verification" }],
    atlas: { nameAr: "", nameEn: item.name, analogType: null, marsCounterpart: null, whyMarsLike: item.supportedClaims.join(" "), missionsUses: null, climateMarsScore: null, climateMarsScoreNote: "Not applicable; no legacy climate score supplied for this supplementary record." }
  };
}
const extras:LocationRecord[]=[];
for(const item of review.sites){
  let record=makeRecord(item);
  const evidence:Record<string,any>={};
  for(const key of ["climate","terrain","geology"]){const path=`data/processed/supplementary-evidence/${item.id}-${key}.json`;try{await access(path);evidence[key]=JSON.parse(await readFile(path,"utf8"));}catch{}}
  if(Object.keys(evidence).length)record=applySupplementaryEvidence(record,evidence);
  extras.push(record);
}
const all = [...base, ...extras];
const errors = validateRecords(all);
if (errors.length) throw new Error(`Reference dataset validation failed: ${JSON.stringify(errors)}`);
const duplicates = all.length - new Set(all.map(record => record.id)).size;
if (duplicates) throw new Error(`Reference dataset contains ${duplicates} duplicate IDs.`);
await mkdir("data/processed", { recursive: true });
async function atomic(path: string, value: unknown) { const temp = `${path}.${process.pid ?? "p"}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temp, path); }
await atomic("data/processed/supplementary-known-sites.json", extras);
await atomic("data/processed/reference-sites.json", all);
const report = { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), status: "valid", originalAtlasCount: base.length, acceptedSupplementaryCount: extras.length, pendingCount: 0, rejectedCount: 0, totalReferenceCount: all.length, pointBasedSupplementaryCount: extras.filter(record => record.latitude !== null && record.longitude !== null).length, regionLevelSupplementaryIds: extras.filter(record => record.latitude === null || record.longitude === null).map(record => record.id), fixtureCountExcluded: 3, errors: [] };
await atomic("data/processed/reference-sites-validation-report.json", report);
console.log(JSON.stringify(report, null, 2));
