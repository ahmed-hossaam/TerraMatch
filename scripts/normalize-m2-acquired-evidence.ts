import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseGeorocCsv, parseUsGsMeteorCraterTable1 } from "../src/data-sources/external-catalogs.js";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("data/evidence/m2/retrieval-manifest-v1.json");
const usgsHtml = await readFile("data/evidence/m2/raw/usgs/ofr2024-1062-full.html", "utf8");
const usgsAttempt = manifest.attempts.find((item: any) => item.sourceId === "usgs-publications" && item.siteId === "MET");
const usgsParsed = parseUsGsMeteorCraterTable1(usgsHtml);
if (usgsParsed.status !== "retrieved" || !usgsAttempt?.attemptedAt) throw new Error(`USGS report extraction failed: ${usgsParsed.error ?? "missing acquisition metadata"}`);

const georocRawPath = "data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv";
const georocCsv = await readFile(georocRawPath, "utf8");
const georocAttempt = manifest.attempts.find((item: any) => item.sourceId === "georoc" && item.siteId === "ETN");
const georocParsed = parseGeorocCsv(georocCsv, georocAttempt?.downloadUrl ?? "https://georoc.eu/georoc/");
if (georocParsed.status !== "retrieved" || !georocAttempt?.attemptedAt) throw new Error(`GEOROC CSV parsing failed: ${georocParsed.error ?? "missing acquisition metadata"}`);
const georocRows = georocParsed.records.filter((row) => row["SAMPLE NAME"]?.includes("SDV-1") && Number.isFinite(Number(row["FEOT(WT%)"])));
if (georocRows.length !== 4) throw new Error(`Expected 4 targeted GEOROC FeOt analyses; parsed ${georocRows.length}.`);

const usgsRecords = usgsParsed.records.map((row) => ({
  evidenceId: `M2:USGS:MET:${row.originalRecordId}`,
  siteId: "MET",
  dimension: "Geological and lithological context",
  factorId: null,
  basis: row.parameter === "Total" ? "derived_value" : "primary_dataset",
  state: "available",
  sourceId: "usgs-publications",
  datasetId: "USGS Open-File Report 2024-1062, Table 1",
  originalRecordId: row.originalRecordId,
  sourceUrl: "https://doi.org/10.3133/ofr20241062",
  relatedDataReleaseUrl: "https://doi.org/10.5066/P9OGAJ8P",
  retrievedAt: usgsAttempt.attemptedAt,
  observationDate: null,
  latitude: null,
  longitude: null,
  coordinateAccuracy: null,
  spatialRelationship: "exact_site",
  locationType: "Meteor Crater ejecta blanket study area; individual mount coordinates not reported in Table 1",
  sampleLabel: row.sampleLabel,
  recordContext: {
    sourceRecordCount: 195,
    sampleCount: 15,
    sampleCountBasis: "The report describes 15 distinct impact-melt particles with pristine glass; each particle is represented by one mount.",
    measurementCount: null,
    measurementCountBasis: "The number of underlying spot analyses is not given in Table 1; the 15-mount average table must not be read as an analytical measurement count.",
    reportedValueCount: 180,
    reportedValueCountBasis: "12 reported average oxide values for each of 15 particles. The 15 Total rows are reported analytical sums, not independent oxide measurements.",
    distinctLocationCount: 4,
    distinctLocationUnit: "drill_hole_contexts",
    distinctLocationBasis: "The 15 particles came from drill holes 45, 60, 94, and 95; Table 1 does not map each mount to a coordinate.",
    analyticalContext: "Table 1 reports average pristine-glass composition by particle/mount. The full study analyzed 42 mounts overall, but this table contains the 15 particles with pristine glass.",
    measurementInterpretation: row.parameter === "Total" ? "reported_analytical_total" : "reported_average"
  },
  parameter: row.parameter,
  value: row.value,
  unit: row.unit,
  material: row.material,
  method: row.method,
  claimSupported: row.parameter === "Total" ? "USGS-reported analytical total for the mount-average glass composition." : "Published major-oxide composition of pristine impact-melt glass averaged by sample mount at Meteor Crater.",
  citation: {
    title: "Characterizing Meteor Crater impact melts through geochemistry and textural analysis",
    authors: ["Amber L. Gullikson", "Tenielle A. Gaither", "Justin J. Hagerty"],
    year: 2025,
    doi: "10.3133/ofr20241062",
    sourceType: "USGS Open-File Report / published measurements",
    supportedClaim: "Table 1 WDS major-oxide compositions in weight percent; glass compositions are mount averages.",
    geographicScope: "Meteor Crater ejecta blanket study area; no mount-specific coordinates in this table.",
    limitations: "These are oxide mass fractions in glass, not mineral identifications, surface abundances, or measurements at the atlas point. The linked full data release was not downloaded."
  },
  rawRecordReference: "data/evidence/m2/raw/usgs/ofr2024-1062-full.html",
  normalizedRecordReference: "data/evidence/m2/normalized/site-acquisitions-v1.json",
  spatialAssociation: "Study locality is the same named Meteor Crater site; per-mount sample coordinates are unavailable.",
  pointComparisonEligible: false,
  qualityNotes: ["Mount-average composition as explicitly described in Table 1.", "No individual sample coordinate or coordinate uncertainty is reported.", ...(row.parameter === "Total" ? ["The Total row is the report's analytical sum, retained separately and not treated as an independent oxide analyte."] : []), "This record supports site-level impact-melt composition only; it does not support the M3 mineral-detection factor."]
}));

const georocRecords = georocRows.map((row, index) => {
  const originalRecordId = `GEOROC:citation-7192:SDV-1:FEOT:row-${index + 1}`;
  return {
    evidenceId: `M2:GEOROC:ETN:${originalRecordId}`,
    siteId: "ETN",
    dimension: "Geological and lithological context",
    factorId: "mineral_evidence",
    basis: "primary_dataset",
    state: "not_representative",
    sourceId: "georoc",
    datasetId: "GEOROC query result; source citation [7192]",
    originalRecordId,
    recordContext: {
      sourceRecordCount: 4,
      sampleCount: 1,
      sampleCountBasis: "All four rows use the same sample label SDV-1 and citation; GEOROC UNIQUE_ID is blank, so a unique sample identifier is unavailable.",
      measurementCount: 4,
      measurementCountBasis: "Four FeOt (wt%) analytical rows for two listed components and associated positions; not four separate samples or locations.",
      reportedValueCount: 4,
      reportedValueCountBasis: "Each of the four source rows reports one FeOt value.",
      distinctLocationCount: null,
      distinctLocationUnit: null,
      distinctLocationBasis: "GEOROC provides broad Etna/Sicily bounds only; distinct sample coordinates or location count cannot be determined.",
      analyticalContext: "Four EMP (EPMA) FeOt analyses: plagioclase core and rim, and olivine phenocryst and groundmass.",
      measurementInterpretation: "individual_analysis"
    },
    sourceUrl: "https://georoc.eu/georoc/new-queryBlank.asp",
    retrievedAt: georocAttempt.attemptedAt,
    observationDate: null,
    latitude: null,
    longitude: null,
    coordinateAccuracy: null,
    sourceCoordinateBounds: { latitudeMin: Number(row["LATITUDE (MIN.)"]), latitudeMax: Number(row["LATITUDE (MAX.)"]), longitudeMin: Number(row["LONGITUDE (MIN.)"]), longitudeMax: Number(row["LONGITUDE (MAX.)"]) },
    spatialRelationship: "regional_context",
    locationType: row.LOCATION,
    sampleLabel: row["SAMPLE NAME"],
    parameter: "FEOT",
    value: Number(row["FEOT(WT%)"]),
    unit: "wt%",
    material: row["TYPE OF MATERIAL"],
    mineralOrComponent: row["MINERAL / COMPONENT"],
    mineralPosition: row["CRYSTAL"] || row["RIM / CORE (MINERAL GRAINS)"],
    method: row.METHOD,
    institution: row.INSTITUTION,
    claimSupported: "FeOt measurement for the listed mineral/component in the GEOROC sample labelled SDV-1, reported from Etna/Sicily.",
    citation: {
      title: "Pb isotopic heterogeneity in basaltic phenocrysts",
      authors: ["Julia G. Bryce", "Donald J. DePaolo"],
      year: 2004,
      doi: "10.1016/j.gca.2004.01.016",
      sourceType: "GEOROC primary-dataset row with original peer-reviewed citation",
      supportedClaim: "The sample name, sample locality, measured FEOT (wt%), mineral/component label, method and institution shown in the returned GEOROC row.",
      geographicScope: "Etna/Sicily; GEOROC supplies bounds 37–38.5 N and 14–16 E, not an exact sample coordinate.",
      limitations: "Regional coordinate bounds include the reference marker but are too broad to locate the sample. Not representative of the exact marker or the whole volcano."
    },
    originalSourceFields: row,
    rawRecordReference: georocRawPath,
    normalizedRecordReference: "data/evidence/m2/normalized/site-acquisitions-v1.json",
    spatialAssociation: "Regional Etna/Sicily record; coordinate bounds are broad and sample-specific coordinates are not supplied.",
    pointComparisonEligible: false,
    qualityNotes: ["The source row has no GEOROC UNIQUE_ID; local row suffix only disambiguates the four returned analyses.", "Reported coordinate bounds are preserved as bounds and are not converted to a sample point.", "An electron-probe FeOt value and mineral/component label do not establish mineral abundance or site-wide composition."]
  };
});

const output = {
  schemaVersion: "1.0.0",
  acquisitionId: "m2-targeted-acquisition-v1",
  generatedAt: new Date().toISOString(),
  sourceRecordCount: usgsRecords.length + georocRecords.length,
  sourceRecordCounts: { usgsMeteorCraterTable1: usgsRecords.length, georocEtnaSampleSDV1: georocRecords.length },
  siteIdsWithRecords: ["MET", "ETN"],
  records: [...usgsRecords, ...georocRecords]
};
await mkdir("data/evidence/m2/normalized", { recursive: true });
await writeFile("data/evidence/m2/normalized/site-acquisitions-v1.json", `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8" });
console.log(JSON.stringify({ sourceRecordCount: output.sourceRecordCount, sourceRecordCounts: output.sourceRecordCounts, siteIdsWithRecords: output.siteIdsWithRecords }));
