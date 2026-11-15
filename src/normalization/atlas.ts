import type { LocationRecord, Measurement, QualityStatus } from "../types/location.js";

const atlasId = "mars-analog-atlas";
const status = (value: unknown): QualityStatus => value == null || value === "" ? "missing" : "legacy_value";
function measurement(value: number | null | undefined, unit: string | null, method = "Copied from legacy atlas; no recalculation") : Measurement {
  return { value: value ?? null, unit, sourceId: atlasId, qualityStatus: status(value), processingMethod: method, observationPeriod: null };
}
export function normalizeAtlasSite(site: any): LocationRecord {
  const warnings: string[] = [];
  if (site.location?.coords_approximate) warnings.push("Atlas marks coordinates approximate.");
  warnings.push("Climate values are legacy atlas values, not independently retrieved or verified in this milestone.");
  if (site.id === "ATA") warnings.push("Atlas notes NASA POWER precipitation (7.3 mm) is higher than the field measurement (<2 mm); retain as disputed legacy context.");
  if (["مصر", "الصين"].includes(site.country)) warnings.push("Atlas notes some mineral descriptions for Egyptian and Gobi sites are inferred partly from general rock composition; they are not point-specific verified mineral evidence.");
  warnings.push("climate_mars_score is climate-only under the atlas formula; it is not an overall similarity score.");
  const minerals = (site.geology?.minerals ?? []).map((m: any) => ({ mineralName: m.name_en ?? m.name ?? m.name_ar ?? "Unnamed mineral", evidenceType: "atlas_description" as const, source: atlasId, locationSpecific: true, verified: false, notes: [m.formula ? `Formula: ${m.formula}` : null, m.mars_link ? `Atlas context: ${m.mars_link}` : null].filter(Boolean).join("; ") || null }));
  const climate = site.climate_nasa_power ?? {};
  const climateMeasurements = [climate.t_mean_C, climate.diurnal_range_C, climate.rh_pct, climate.precip_mm_yr, climate.wind_ms, climate.solar_kwh_m2_day];
  const missingFactors = climateMeasurements.flatMap((v, i) => v == null ? [ ["meanTemperatureC", "meanDailyTemperatureRangeC", "meanHumidityPct", "annualPrecipitationMm", "meanWindSpeedMs", "meanSolarRadiation"][i] ] : []);
  const sourceUrl = climate.source_url ?? null;
  return {
    id: site.id, recordType: "known_analog", planet: "Earth", latitude: site.location?.lat ?? null, longitude: site.location?.lon ?? null,
    coordinatesApproximate: site.location?.coords_approximate ?? null, country: site.country ?? null, regionName: site.name_en ?? null,
    discoveryMethod: "Existing 26-site atlas; reference record, not generated candidate",
    elevationMeanM: measurement(site.location?.elevation_m, "m"),
    climate: { observationPeriod: null, meanTemperatureC: measurement(climate.t_mean_C, "°C"), meanDailyTemperatureRangeC: measurement(climate.diurnal_range_C, "°C"), meanHumidityPct: measurement(climate.rh_pct, "%"), annualPrecipitationMm: measurement(climate.precip_mm_yr, "mm/year", "Legacy atlas value; atlas notes may qualify measurement"), meanWindSpeedMs: measurement(climate.wind_ms, "m/s"), meanSolarRadiation: measurement(climate.solar_kwh_m2_day, "kWh/m²/day"), missingDays: null, validDays: null, coverage: null },
    terrain: { elevationMinM: measurement(null, "m"), elevationMaxM: measurement(null, "m"), slopeMeanDeg: measurement(null, "°"), slopeP95Deg: measurement(null, "°"), roughness: measurement(null, null), rasterResolutionM: null, sourceId: null, qualityStatus: "missing" },
    geology: { lithology: { classification: null, sourceId: atlasId, qualityStatus: "missing" }, minerals, formationDescription: site.geology?.formation ?? null, rockDescription: site.geology?.rocks ?? null, references: site.references ?? [], evidenceQuality: "needs_verification" },
    dataQuality: { coverage: null, confidence: null, missingFactors: [...missingFactors, "formal lithology classification"], warnings, validationErrors: [], qualityNotes: ["No numeric similarity or confidence score is calculated.", "Mineral names are preserved as atlas descriptions and are not treated as independently verified point measurements.", "Atlas rock description is kept separate from formal lithology classification."] },
    provenance: [{ sourceId: atlasId, provider: "Provided project atlas", endpointOrDataset: "Mars_Analogues_Haneen_Ayman atlas sites", sourceUrl, retrievedAt: null, requestParameters: null, originalUnit: null, outputUnit: null, processingMethod: "Field mapping from source atlas; source record preserved unchanged", spatialResolution: "Site coordinates; approximate flag retained", temporalResolution: null, qualityStatus: "legacy_value" }],
    atlas: { nameAr: site.name_ar ?? "", nameEn: site.name_en ?? "", analogType: site.analog_type ?? null, marsCounterpart: site.mars_counterpart ?? null, whyMarsLike: site.why_mars_like ?? null, missionsUses: site.missions_uses ?? null, climateMarsScore: site.climate_mars_score ?? null, climateMarsScoreNote: "Legacy climate-only atlas score. Not an overall scientific similarity score; not mixed with retrieved measurements." }
  };
}
