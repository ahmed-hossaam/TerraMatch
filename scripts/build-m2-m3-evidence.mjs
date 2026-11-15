import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const refs = await read("data/processed/reference-sites.json");
const curation = await read("data/curation/reference-curation-v1.json");
const profile = await read("data/mission-profiles/mars-surface-v1.json");
const acquisition = await read("data/evidence/m2/normalized/site-acquisitions-v1.json");
const retrievalManifest = await read("data/evidence/m2/retrieval-manifest-v1.json");
const m1 = new Map(curation.records.map((record) => [record.stableId, record]));
const sourceDocs = [
  { id: "usgs-tadp-sciencebase", name: "USGS Terrestrial Analogs Data Portal / ScienceBase", url: "https://tadp.astrogeology.usgs.gov/", type: "catalog" },
  { id: "usgs-paad", name: "USGS Planetary Aeolian Analog Database", url: "https://doi.org/10.5066/P9IFVZEX", type: "dataset" },
  { id: "earthchem-petdb", name: "EarthChem / PetDB", url: "https://earthchem.github.io/ec-doc/documentation/petdb_api.html", type: "catalog" },
  { id: "georoc", name: "GEOROC", url: "https://georoc.eu/georoc/", type: "download_catalog" },
  { id: "usgs-publications", name: "USGS Open-File Report 2024-1062 and associated Meteor Crater data release", url: "https://doi.org/10.3133/ofr20241062", type: "official_report_and_data_release" },
];
const out = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8"); };
const csv = async (path, rows) => { const columns = Object.keys(rows[0] ?? {}); const cell = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`; await mkdir(dirname(path), { recursive: true }); await writeFile(path, [columns.map(cell).join(","), ...rows.map((r) => columns.map((key) => cell(r[key])).join(","))].join("\n") + "\n", "utf8"); };

const acquisitionBySourceSite = (sourceId, siteId) => acquisition.records.filter((record) => record.sourceId === sourceId && record.siteId === siteId);
await csv("docs/audits/m2-completion/actual-retrieval-results.csv", retrievalManifest.attempts.map((attempt) => ({
  sourceId: attempt.sourceId, siteId: attempt.siteId, method: attempt.method, url: attempt.url, query: attempt.query,
  attemptedAt: attempt.attemptedAt ?? "not captured", httpStatus: attempt.httpStatus ?? "", outcome: attempt.outcome,
  responseSummary: attempt.responseSummary, retrievedRecordCount: attempt.outcome === "retrieved_regional_records" || attempt.outcome === "retrieved_published_measurements" ? acquisitionBySourceSite(attempt.sourceId, attempt.siteId).length : 0,
  downloadUrl: attempt.downloadUrl ?? "", rawArtifactPath: attempt.rawArtifactPath ?? ""
})));
await csv("docs/audits/m2-completion/new-evidence-records.csv", acquisition.records.map((record) => ({
  evidenceId: record.evidenceId, siteId: record.siteId, sourceId: record.sourceId, datasetId: record.datasetId,
  originalRecordId: record.originalRecordId, dimension: record.dimension, factorId: record.factorId ?? "",
  basis: record.basis, state: record.state, sampleLabel: record.sampleLabel, locationType: record.locationType,
  spatialRelationship: record.spatialRelationship, latitude: record.latitude ?? "", longitude: record.longitude ?? "",
  sourceCoordinateBounds: record.sourceCoordinateBounds ? JSON.stringify(record.sourceCoordinateBounds) : "",
  sourceRecordCount: record.recordContext.sourceRecordCount, sampleCount: record.recordContext.sampleCount ?? "unknown",
  sampleCountBasis: record.recordContext.sampleCountBasis, measurementCount: record.recordContext.measurementCount ?? "unknown",
  measurementCountBasis: record.recordContext.measurementCountBasis, reportedValueCount: record.recordContext.reportedValueCount ?? "unknown",
  reportedValueCountBasis: record.recordContext.reportedValueCountBasis, distinctLocationCount: record.recordContext.distinctLocationCount ?? "unknown",
  distinctLocationUnit: record.recordContext.distinctLocationUnit ?? "unknown",
  distinctLocationBasis: record.recordContext.distinctLocationBasis, analyticalContext: record.recordContext.analyticalContext,
  measurementInterpretation: record.recordContext.measurementInterpretation,
  parameter: record.parameter, value: record.value, unit: record.unit, material: record.material,
  mineralOrComponent: record.mineralOrComponent ?? "", method: record.method ?? "", institution: record.institution ?? "",
  citation: `${record.citation.title} (${record.citation.year})`, citationUrl: `https://doi.org/${record.citation.doi}`,
  retrievedAt: record.retrievedAt, rawRecordReference: record.rawRecordReference,
  normalizedRecordReference: record.normalizedRecordReference, claimSupported: record.claimSupported,
  pointComparisonEligible: false, limitations: record.qualityNotes.join(" ")
})));

const attemptsBySourceSite = new Map();
for (const attempt of retrievalManifest.attempts) {
  const key = `${attempt.sourceId}/${attempt.siteId}`;
  attemptsBySourceSite.set(key, [...(attemptsBySourceSite.get(key) ?? []), attempt]);
}
const recordsBySourceSite = new Map();
for (const record of acquisition.records) {
  const key = `${record.sourceId}/${record.siteId}`;
  recordsBySourceSite.set(key, [...(recordsBySourceSite.get(key) ?? []), record]);
}
const m2rows = refs.flatMap((site) => sourceDocs.map((source) => {
  const key = `${source.id}/${site.id}`;
  const attempts = attemptsBySourceSite.get(key) ?? [];
  const records = recordsBySourceSite.get(key) ?? [];
  const status = records.length ? "retrieved" : attempts.length ? attempts.at(-1).outcome : "not_queried";
  return {
    siteId: site.id,
    siteName: site.regionName,
    sourceId: source.id,
    retrievalStatus: status,
    queryCount: attempts.length,
    retrievedRecordCount: records.length,
    matchedRecordId: records.slice(0, 5).map((record) => record.originalRecordId).join("; "),
    sourceRecordUrl: records[0]?.sourceUrl ?? attempts.at(-1)?.url ?? "",
    spatialRelationship: records[0]?.spatialRelationship ?? "unmatched",
    claimSupported: records.length ? [...new Set(records.map((record) => record.claimSupported))].join("; ") : "",
    queryAndResponseSummary: attempts.map((attempt) => `${attempt.method} ${attempt.url} -> HTTP ${attempt.httpStatus}: ${attempt.responseSummary}`).join(" | "),
    reason: records.length ? [...new Set(records.map((record) => record.spatialAssociation))].join("; ") : attempts.map((attempt) => `${attempt.outcome}: ${attempt.responseSummary}`).join("; ") || "No targeted query was made for this site/source pair."
  };
}));
await csv("docs/audits/m2-m3/M2-site-source-matching.csv", m2rows);
const m2SourceCoverage = sourceDocs.map((source) => {
  const attempts = retrievalManifest.attempts.filter((attempt) => attempt.sourceId === source.id);
  const records = acquisition.records.filter((record) => record.sourceId === source.id);
  return {
    sourceId: source.id, officialName: source.name, officialUrl: source.url, accessMethod: source.type,
    sitesReviewed: refs.length, sitesQueried: new Set(attempts.map((attempt) => attempt.siteId)).size,
    matchedSites: new Set(records.map((record) => record.siteId)).size,
    recordsRetrieved: records.length,
    sourceOutcome: records.length ? "retrieved_with_spatial_limits" : attempts.some((attempt) => attempt.httpStatus === 403) ? "blocked_http_403" : attempts.some((attempt) => attempt.httpStatus >= 500) ? "provider_http_5xx" : "not_queried_for_selected_sites",
    rawArtifactCount: new Set(records.map((record) => record.rawRecordReference)).size,
    normalizedEvidenceCount: records.length
  };
});
await csv("docs/audits/m2-m3/M2-source-coverage-matrix.csv", m2SourceCoverage);
await out("data/evidence/m2-retrieval-coverage-v1.json", { schemaVersion: "1.0.0", createdAt: retrievalManifest.acquisitionDate, generatedAt: new Date().toISOString(), sources: m2SourceCoverage, attempts: retrievalManifest.attempts, rawArtifactPaths: [...new Set(acquisition.records.map((record) => record.rawRecordReference))], normalizedRecordCount: acquisition.records.length });
if (process.env.M2_ONLY === "1") { console.log(JSON.stringify({ referenceCount: refs.length, siteSourceRows: m2rows.length, successfulSourceRecords: acquisition.records.length, sourceCoverage: m2SourceCoverage })); process.exit(0); }

const allFactors = profile.dimensions.flatMap((dimension) => dimension.factors.map((factor) => ({ ...factor, dimensionId: dimension.id, dimensionName: dimension.name })));
const histories = await read("data/processed/climate/known-sites-daily.json").catch(() => []);
const climateRows = Array.isArray(histories) ? histories : [histories];
const climateById = new Map(climateRows.filter((x) => x?.locationId).map((x) => [x.locationId, x]));
const climateIds = new Set(climateById.keys());
const terrains = await read("data/processed/terrain/elevation-samples.json").catch(() => []);
const geology = await read("data/processed/geology/known-sites-glim.json").catch(() => []);
const rawClimateFiles = await readdir("data/raw/nasa-power");
const rawTerrainFiles = await readdir("data/raw/copernicus-dem");
const rawGeologyFiles = await readdir("data/raw/glim");
for (const id of ["DALL", "DAL", "AHS-GH"]) {
  const record = await read(`data/processed/supplementary-evidence/${id}-climate.json`).catch(() => null);
  if (record) { climateIds.add(id); climateById.set(id, record); }
}
const terrainIds = new Set((Array.isArray(terrains) ? terrains : []).map((x) => x.locationId));
const geologyIds = new Set((Array.isArray(geology) ? geology : []).map((x) => x.locationId));
const terrainById = new Map((Array.isArray(terrains) ? terrains : []).map((x) => [x.locationId, x]));
const geologyById = new Map((Array.isArray(geology) ? geology : []).map((x) => [x.locationId, x]));
for (const id of ["DALL", "DAL", "AHS-GH"]) {
  const terrainRecord = await read(`data/processed/supplementary-evidence/${id}-terrain.json`).catch(() => null);
  const geologyRecord = await read(`data/processed/supplementary-evidence/${id}-geology.json`).catch(() => null);
  if (terrainRecord) { terrainIds.add(id); terrainById.set(id, terrainRecord); }
  if (geologyRecord) { geologyIds.add(id); geologyById.set(id, geologyRecord); }
}
const summaryParam = { air_temperature_daily_mean: "T2M", relative_humidity: "RH2M", precipitation: "PRECTOTCORR", wind_speed: "WS10M", solar_radiation: "ALLSKY_SFC_SW_DWN" };
function storedValue(siteId, factorId, provider) {
  if (!provider || !provider.siteIds.has(siteId)) return null;
  if (provider.sourceId === "nasa-power-daily-point") {
    const history = climateById.get(siteId);
    if (!history) return null;
    if (factorId === "air_temperature_extremes") return { T2M_MAX: history.summaries?.T2M_MAX ?? null, T2M_MIN: history.summaries?.T2M_MIN ?? null };
    if (factorId === "daily_temperature_range") {
      const values = (history.daily ?? []).map((day) => day.temperatureRangeC?.qualityStatus === "valid" && Number.isFinite(day.temperatureRangeC.value) ? day.temperatureRangeC.value : null).filter((value) => value !== null);
      return { mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, validObservationCount: values.length, missingObservationCount: Math.max(0, (history.daily?.length ?? 0) - values.length), unit: "°C", method: "Mean of stored daily T2M_MAX minus T2M_MIN values; only valid daily pairs included." };
    }
    return history.summaries?.[summaryParam[factorId]] ?? null;
  }
  if (provider.sourceId === "copernicus-dem-glo-30") { const terrain = terrainById.get(siteId); return terrain?.elevationSampleM ?? null; }
  const record = geologyById.get(siteId), evidence = record?.lithologyEvidence;
  if (!evidence) return null;
  return { status: evidence.status, features: (evidence.features ?? []).map((feature) => ({ objectId: feature.objectId, classification: feature.litho, levels: feature.levels, descriptions: feature.descriptions })) };
}
const mappedProvider = (factor) => {
  const id = factor.id;
  if (["air_temperature_daily_mean", "air_temperature_extremes", "daily_temperature_range", "relative_humidity", "precipitation", "wind_speed", "solar_radiation"].includes(id)) return { provider: "NASA POWER", sourceId: "nasa-power-daily-point", basis: "primary_dataset", siteIds: climateIds, normalizedName: (siteId) => ["DALL", "DAL", "AHS-GH"].includes(siteId) ? `data/processed/supplementary-evidence/${siteId}-climate.json` : "data/processed/climate/known-sites-daily.json", rawFiles: rawClimateFiles, rawName: (siteId) => rawClimateFiles.find((name) => name.startsWith(`${siteId}_`) && name.endsWith(".json") && !name.endsWith(".meta.json")), limit: "Gridded/model-derived daily product; requested point is not a ground station." };
  if (id === "elevation_point") return { provider: "Copernicus DEM", sourceId: "copernicus-dem-glo-30", basis: "primary_dataset", siteIds: terrainIds, normalizedName: (siteId) => ["DALL", "DAL", "AHS-GH"].includes(siteId) ? `data/processed/supplementary-evidence/${siteId}-terrain.json` : "data/processed/terrain/elevation-samples.json", rawFiles: rawTerrainFiles, rawName: (siteId) => `${siteId}_GLO-30.json`, rawDirectory: "data/raw/copernicus-dem", limit: "One DSM pixel, not a site mean or terrain survey." };
  if (["mapped_lithology", "surface_material_class"].includes(id)) return { provider: "GLiM", sourceId: "glim-v1.1-level-i", basis: "primary_dataset", siteIds: geologyIds, normalizedName: (siteId) => ["DALL", "DAL", "AHS-GH"].includes(siteId) ? `data/processed/supplementary-evidence/${siteId}-geology.json` : "data/processed/geology/known-sites-glim.json", rawFiles: rawGeologyFiles, rawName: (siteId) => `${siteId}_GLiM.json`, rawDirectory: "data/raw/glim", limit: "Generalized mapped lithology; not mineral detection or field confirmation." };
  return null;
};
const evidenceRecords = [];
const coverageRows = [];
const curationById = new Map(curation.records.map((record) => [record.stableId, record]));
const supplementalRecords = acquisition.records.map((record) => ({ ...record, curationDecision: curationById.get(record.siteId)?.preliminaryDecision ?? "exclude_pending_review", pointComparisonEligible: false }));
for (const site of refs) {
  const curate = m1.get(site.id);
  for (const factor of allFactors) {
    const provider = mappedProvider(factor);
    const present = !!provider?.siteIds.has(site.id);
    const dimensionKey = factor.dimensionId === "climate" ? "climate" : factor.dimensionId === "terrain" ? "terrain" : factor.dimensionId === "geology_lithology" ? "lithology" : factor.dimensionId === "surface_material_hydrology" ? (factor.id === "hydrological_context" ? "water_ice" : factor.id === "mineral_evidence" ? "mineralogy" : "lithology") : "geological_processes";
    const claim = curate?.evidenceByDimension?.[dimensionKey];
    const legacyAvailable = ["atlas_claim", "derived_value", "conflicting"].includes(claim?.status);
    let sourceState = present ? "available" : provider ? "not_retrieved" : "unavailable";
    const value = present ? storedValue(site.id, factor.id, provider) : null;
    if (present && provider.sourceId === "glim-v1.1-level-i" && value?.status === "no_feature") sourceState = "no_matching_records";
    if (present && provider.sourceId === "glim-v1.1-level-i" && value?.status === "no_data_class") sourceState = "source_no_data_class";
    if (present && provider.sourceId === "glim-v1.1-level-i" && value?.status === "ambiguous") sourceState = "ambiguous";
    const basis = present ? (factor.id === "daily_temperature_range" ? "derived_value" : provider.basis) : legacyAvailable ? claim.status : "unverified";
    const limitations = [provider?.limit, claim?.note, factor.limitations?.join(" ")].filter(Boolean);
    const rawRecordReference = present && provider.rawName?.(site.id) && provider.rawFiles.includes(provider.rawName(site.id)) ? `${provider.rawDirectory ?? "data/raw/nasa-power"}/${provider.rawName(site.id)}` : null;
    const history = present && provider?.sourceId === "nasa-power-daily-point" ? climateById.get(site.id) : null;
    const terrainRecord = present && provider?.sourceId === "copernicus-dem-glo-30" ? terrainById.get(site.id) : null;
    const geologyRecord = present && provider?.sourceId === "glim-v1.1-level-i" ? geologyById.get(site.id) : null;
    const record = { evidenceId: `${site.id}:${factor.id}:v1`, siteId: site.id, dimension: factor.dimensionName, dimensionId: factor.dimensionId, factorId: factor.id, basis, state: sourceState, legacyClaimState: legacyAvailable ? "available_as_claim_only" : "none_recorded", sourceId: present ? provider.sourceId : legacyAvailable ? "mars-analog-atlas" : provider?.sourceId ?? null, sourceUrl: present ? factor.evidenceAvailability?.sourceUrl ?? null : null, datasetId: present ? factor.evidenceAvailability?.dataset ?? provider.sourceId : legacyAvailable ? "supplied-atlas" : null, originalRecordId: null, retrievedAt: history?.provenance?.retrievedAt ?? terrainRecord?.retrievedAt ?? geologyRecord?.retrievedAt ?? null, observationPeriod: present ? factor.evidenceAvailability?.observationPeriod ?? null : null, latitude: site.latitude ?? null, longitude: site.longitude ?? null, spatialRelationship: present ? (factor.id === "mapped_lithology" || factor.id === "surface_material_class" ? "generalized_polygon_at_requested_coordinate" : factor.id === "elevation_point" ? "single_raster_pixel_at_requested_coordinate" : "gridded_product_at_requested_coordinate") : "unknown", parameter: factor.id, value, unit: factor.unit || null, rawRecordReference, normalizedRecordReference: present ? provider.normalizedName(site.id) : legacyAvailable ? "data/processed/known-sites.json (legacy claim retained)" : null, qualityLimitations: [...new Set(limitations)], curationDecision: curate?.preliminaryDecision ?? "exclude_pending_review", pointComparisonEligible: curate?.pointComparisonEligible === true };
    const supportingExternal = supplementalRecords.filter((item) => item.siteId === site.id && item.factorId === factor.id);
    if (supportingExternal.length) {
      record.state = "not_representative";
      record.basis = "primary_dataset";
      record.sourceId = supportingExternal[0].sourceId;
      record.sourceUrl = supportingExternal[0].sourceUrl;
      record.datasetId = supportingExternal[0].datasetId;
      record.retrievedAt = supportingExternal[0].retrievedAt;
      record.spatialRelationship = "regional";
      record.rawRecordReference = supportingExternal[0].rawRecordReference;
      record.normalizedRecordReference = supportingExternal[0].normalizedRecordReference;
      record.supplementalEvidenceIds = supportingExternal.map((item) => item.evidenceId);
      record.qualityLimitations.push("Regional GEOROC analyses exist for this factor but their broad source coordinate bounds do not locate a representative sample at this reference marker; see the linked supplemental records.");
    }
    evidenceRecords.push(record);
    const supplemental = supplementalRecords.filter((item) => item.siteId === site.id && item.factorId === factor.id);
    coverageRows.push({ siteId: site.id, siteName: site.regionName, curationDecision: record.curationDecision, pointComparisonEligible: record.pointComparisonEligible, dimension: factor.dimensionName, dimensionId: factor.dimensionId, factorId: factor.id, providerEvidenceState: sourceState, evidenceBasis: basis, legacyClaimState: record.legacyClaimState, sourceId: record.sourceId, sourceRecordPath: record.rawRecordReference, supplementalEvidenceCount: supplemental.length, supplementalEvidenceIds: supplemental.map((item) => item.evidenceId).join(";"), limitations: limitations.join(" ") });
  }
}
const eligibilityPolicy = { policyId: "reference-curation-v1-point-eligibility", manifestPath: "data/curation/reference-curation-v1.json", comparisonEligibleRule: "pointComparisonEligible=true and disposition keep_verified/keep_with_limitations", archiveRecords: refs.length, eligibleSiteIds: curation.records.filter((r) => r.pointComparisonEligible === true).map((r) => r.stableId), excludedSiteIds: curation.records.filter((r) => r.pointComparisonEligible !== true).map((r) => r.stableId) };
const siteSupplementalSummary = refs.map((site) => {
  const records = supplementalRecords.filter((record) => record.siteId === site.id);
  return { siteId: site.id, count: records.length, evidenceIds: records.map((record) => record.evidenceId), bySource: Object.fromEntries([...new Set(records.map((record) => record.sourceId))].map((sourceId) => [sourceId, records.filter((record) => record.sourceId === sourceId).length])), byFactor: Object.fromEntries([...new Set(records.filter((record) => record.factorId).map((record) => record.factorId))].map((factorId) => [factorId, records.filter((record) => record.factorId === factorId).length])) };
});
await out("data/evidence/evidence-registry-v1.json", { schemaVersion: "1.0.0", evidenceModelVersion: "1.0.0", generatedAt: new Date().toISOString(), sourceOfCurationAuthority: "data/curation/reference-curation-v1.json", sourceOfFactors: "data/mission-profiles/mars-surface-v1.json", policy: eligibilityPolicy, records: evidenceRecords, supplementalRecordCount: supplementalRecords.length, supplementalRecords });
await csv("docs/audits/m2-m3/M3-evidence-coverage-matrix.csv", coverageRows);
await out("data/evidence/evidence-coverage-v1.json", { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), siteCount: refs.length, dimensionCount: profile.dimensions.length, factorCount: allFactors.length, evidenceStateCounts: Object.fromEntries(["available", "not_retrieved", "no_matching_records", "retrieval_failed", "unavailable", "not_representative", "insufficient_provenance", "source_no_data_class", "ambiguous", "missing"].map((state) => [state, evidenceRecords.filter((r) => r.state === state).length])), eligibleSiteIds: eligibilityPolicy.eligibleSiteIds, excludedSiteIds: eligibilityPolicy.excludedSiteIds, coverage: coverageRows, supplementalRecordCount: supplementalRecords.length, siteSupplementalSummary });
console.log(JSON.stringify({ referenceCount: refs.length, m2SiteSourceRows: m2rows.length, factorEvidenceRecords: evidenceRecords.length, supplementalEvidenceRecords: supplementalRecords.length, factors: allFactors.length, eligibilityPolicy }));
