import { createHash } from "node:crypto";

export const REMS_SCHEMA_VERSION = "1.0.0";
export const REMS_EXTRACTION_VERSION = "terramatch-rems-modrdr-1.0.0";
export const REMS_SOURCE = {
  datasetId: "MSL-M-REMS-5-MODRDR-V1.0",
  volumeId: "mslrem_1001",
  datasetUrl: "https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MSL-M-REMS-5-MODRDR-V1.0",
  volumeUrl: "https://atmos.nmsu.edu/PDS/data/mslrem_1001/",
  temperatureDocumentationUrl: "https://atmos.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems_temperature.html",
  sisUrl: "https://cab.inta-csic.es/rems/wp-content/uploads/2013/04/REMS_RDR_SIS.pdf",
  solarLongitudeMethodUrl: "https://www.giss.nasa.gov/tools/mars24/help/algorithm.html",
} as const;

export type RemsSourceSol = { sol: number; tab: string; labelXml: string; productUrl: string; sourceProductId?: string; sourceSha256: string; labelSha256: string; retrievedAt?: string };
type ParsedMeasurement = { sol: number; timestamp: number; ls: number; ambientTempK: number; confidenceCode: string };
type SolSummary = {
  sol: number; solarLongitudeDegrees: number; solarLongitudeBin: string; marsYearIndex: number;
  sourceProducts: Array<{ productId: string | null; productUrl: string; sourceSha256: string; labelSha256: string }>;
  sourceRecordCount: number; validSampleCount: number; rejectedSampleCount: number;
  rejectionCounts: { missingTemperature: number; unknownOrMalformedConfidence: number; nonOptimalConfidence: number };
  confidenceCodeCounts: Record<string, number>; sampleMeanK: number | null; observedSampleMinimumK: number | null;
  observedSampleMaximumK: number | null; observedSampleRangeK: number | null; validSampleTemperatureK: number[];
};

function csvFields(line: string): string[] {
  const fields: string[] = []; let field = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { fields.push(field.trim()); field = ""; }
    else field += ch;
  }
  fields.push(field.trim());
  return fields;
}

function radians(degrees: number): number { return degrees * Math.PI / 180; }
function normalizeDegrees(degrees: number): number { return ((degrees % 360) + 360) % 360; }
function ttMinusUtc(date: Date): number {
  const cutovers: Array<[string, number]> = [
    ["2012-07-01T00:00:00Z", 67.184], ["2015-07-01T00:00:00Z", 68.184], ["2017-01-01T00:00:00Z", 69.184],
  ];
  let seconds = 67.184;
  for (const [at, value] of cutovers) if (date.getTime() >= Date.parse(at)) seconds = value;
  return seconds;
}

/** Mars24 / Allison-McEwen Ls computation, including the published perturber terms. */
export function marsSolarLongitudeDegrees(utc: Date): number {
  if (!(utc instanceof Date) || !Number.isFinite(utc.getTime())) throw new Error("A valid UTC timestamp is required to derive Mars solar longitude.");
  const jdTt = 2440587.5 + utc.getTime() / 86_400_000 + ttMinusUtc(utc) / 86_400;
  const deltaT = jdTt - 2451545;
  const m = 19.3871 + 0.52402073 * deltaT;
  const alphaFms = 270.3871 + 0.524038496 * deltaT;
  const terms: Array<[number, number, number]> = [[0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837], [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.002, 2.4694, 95.528], [0.0018, 32.8493, 49.095]];
  const pbs = terms.reduce((sum, [amplitude, period, phase]) => sum + amplitude * Math.cos(radians(0.985626 * deltaT / period + phase)), 0);
  const equationOfCenter = (10.691 + 3e-7 * deltaT) * Math.sin(radians(m)) + 0.623 * Math.sin(radians(2 * m)) + 0.05 * Math.sin(radians(3 * m)) + 0.005 * Math.sin(radians(4 * m)) + 0.0005 * Math.sin(radians(5 * m)) + pbs;
  return normalizeDegrees(alphaFms + equationOfCenter);
}

export function remsSolarLongitudeBin(ls: number, width = 30): string {
  if (!Number.isFinite(ls) || ls < 0 || ls >= 360 || width <= 0 || 360 % width !== 0) throw new Error("Ls must be in [0, 360) and bin width must divide 360.");
  const start = Math.floor(ls / width) * width;
  return `${String(start).padStart(3, "0")}-${String(start + width).padStart(3, "0")}`;
}

function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * p; const lower = Math.floor(index); const upper = Math.ceil(index);
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower);
}

export function summarizePowerHistory(history: any) {
  const daily = Array.isArray(history?.daily) ? history.daily : [];
  const values: number[] = []; let missing = 0;
  for (const row of daily) {
    const measure = row?.measurements?.T2M;
    const value = measure?.value;
    if (typeof value === "number" && Number.isFinite(value)) values.push(value); else missing++;
  }
  return {
    provider: "NASA POWER", dataset: "Daily Point API T2M", measurementType: "Gridded/model-derived daily 2 m air-temperature product",
    parameter: "T2M", unit: "°C", period: history?.actualObservationPeriod ?? null,
    requestedCoordinate: history?.requestedCoordinate ?? null, providerResponseCoordinate: history?.providerResponseCoordinate ?? null,
    validObservationCount: values.length, missingObservationCount: missing,
    q25: quantile(values, 0.25), median: quantile(values, 0.5), q75: quantile(values, 0.75),
    provenance: { sourceUrl: history?.endpoint ?? "https://power.larc.nasa.gov/api/temporal/daily/point", sourceId: "nasa-power-daily-point" },
  };
}

function sourceRows(source: RemsSourceSol): ParsedMeasurement[] {
  const labelBlocks = [...source.labelXml.matchAll(/<Field_Character>[\s\S]*?<\/Field_Character>/gi)].map((match) => match[0]);
  const labelFields = labelBlocks.map((block) => block.match(/<name>([^<]+)<\/name>/i)?.[1]?.trim() ?? "");
  if (labelFields[15] !== "AMBIENT_TEMP" || labelFields[16] !== "AMBIENT_TEMP_CONFIDENCE_LEVEL") throw new Error(`PDS product label fields do not match the expected ambient temperature/QC order for sol ${source.sol}.`);
  const confidenceDescription = labelBlocks[16]?.match(/<description>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ") ?? "";
  if (!/byte 7: Operational range[^;]*error[^;]*<\s*5\s*kelvin/i.test(confidenceDescription) || !/byte 8: Observation reliability/i.test(confidenceDescription) || !/1\s*=\s*reliable/i.test(confidenceDescription)) throw new Error(`PDS product label does not define the expected temperature QC bytes for sol ${source.sol}.`);
  const startText = source.labelXml.match(/<start_date_time>([^<]+)<\/start_date_time>/)?.[1];
  const stopText = source.labelXml.match(/<stop_date_time>([^<]+)<\/stop_date_time>/)?.[1];
  if (!startText || !stopText) throw new Error(`PDS observational label lacks start/stop date-time for sol ${source.sol}.`);
  const labelStart = new Date(startText); const labelStop = new Date(stopText);
  if (!Number.isFinite(labelStart.getTime()) || !Number.isFinite(labelStop.getTime()) || labelStop < labelStart) throw new Error(`PDS observational label has an invalid UTC interval for sol ${source.sol}.`);
  const productLs = marsSolarLongitudeDegrees(new Date((labelStart.getTime() + labelStop.getTime()) / 2));
  const lines = source.tab.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) throw new Error(`REMS MODRDR product is empty for sol ${source.sol}.`);
  const parsed = lines.map((line) => {
    const columns = csvFields(line);
    if (columns.length < 17) throw new Error(`REMS MODRDR row has ${columns.length} fields; expected at least 17.`);
    const timestamp = Number(columns[0]);
    const lmst = columns[1].replace(/^"|"$/g, "").trim();
    const rowSol = Number(lmst.match(/^(\d+)M/)?.[1]);
    const temperature = Number(columns[15]);
    const confidenceCode = columns[16].replace(/^"|"$/g, "").trim().toUpperCase();
    if (!Number.isFinite(timestamp) || !Number.isSafeInteger(rowSol) || !Number.isFinite(temperature)) throw new Error(`Malformed REMS MODRDR row in sol ${source.sol}.`);
    if (rowSol !== source.sol) throw new Error(`REMS filename/LMST sol mismatch: expected ${source.sol}, received ${rowSol}.`);
    return { sol: rowSol, timestamp, ls: productLs, ambientTempK: temperature, confidenceCode };
  });
  return parsed;
}
function productUtcInterval(source: RemsSourceSol) {
  return { startUtc: source.labelXml.match(/<start_date_time>([^<]+)<\/start_date_time>/)?.[1] ?? null, stopUtc: source.labelXml.match(/<stop_date_time>([^<]+)<\/stop_date_time>/)?.[1] ?? null };
}

function summarizeSol(sol: number, sources: RemsSourceSol[]): SolSummary {
  const measurements = sources.flatMap((source) => sourceRows(source));
  if (measurements.some((row) => row.sol !== sol)) throw new Error(`REMS product collection contains an unexpected sol for ${sol}.`);
  const valid: ParsedMeasurement[] = [];
  const rejectionCounts = { missingTemperature: 0, unknownOrMalformedConfidence: 0, nonOptimalConfidence: 0 };
  const confidenceCodeCounts: Record<string, number> = {};
  for (const row of measurements) {
    confidenceCodeCounts[row.confidenceCode] = (confidenceCodeCounts[row.confidenceCode] ?? 0) + 1;
    if (row.ambientTempK === -999 || row.ambientTempK < 0) { rejectionCounts.missingTemperature++; continue; }
    if (!/^[01X]{9}$/.test(row.confidenceCode) || row.confidenceCode[7] === "X" || row.confidenceCode[8] === "X") { rejectionCounts.unknownOrMalformedConfidence++; continue; }
    // Require the field-label-defined temperature operational-range (byte 7) and
    // observation-reliability (byte 8) checks. Other bytes describe contextual
    // conditions; their X/0 values are retained in code counts, not conflated with
    // the two direct acceptance checks.
    if (row.confidenceCode[7] !== "1" || row.confidenceCode[8] !== "1") { rejectionCounts.nonOptimalConfidence++; continue; }
    valid.push(row);
  }
  const values = valid.map((row) => row.ambientTempK);
  const lsValues = measurements.map((row) => row.ls);
  const ls = quantile(lsValues, 0.5) ?? null;
  const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  return {
      sol, solarLongitudeDegrees: ls!, solarLongitudeBin: remsSolarLongitudeBin(ls!), marsYearIndex: 0,
      sourceProducts: sources.map((source) => ({ productId: source.sourceProductId ?? null, productUrl: source.productUrl, sourceSha256: source.sourceSha256, labelSha256: source.labelSha256, ...productUtcInterval(source) })), sourceRecordCount: measurements.length,
      validSampleCount: valid.length, rejectedSampleCount: measurements.length - valid.length, rejectionCounts, confidenceCodeCounts,
      sampleMeanK: mean, observedSampleMinimumK: minimum, observedSampleMaximumK: maximum,
      observedSampleRangeK: minimum == null || maximum == null ? null : maximum - minimum, validSampleTemperatureK: values,
  };
}

export function buildRemsAirTemperatureArtifact(input: {
  sourceProducts: RemsSourceSol[]; retrievedAt: string; powerHistories: Record<string, any>;
  expectedPowerSiteIds: string[]; marsMissionProfile: any; plannedSolIds?: number[]; noProductSolIds?: number[]; noProductSolDetails?: Array<{ sol: number; reason: string; httpStatus?: number | null }>;
}) {
  if (!input.sourceProducts.length) throw new Error("At least one actual PDS REMS source product is required.");
  const sourceProducts = [...input.sourceProducts].sort((a, b) => a.sol - b.sol || a.productUrl.localeCompare(b.productUrl));
  const productsBySol = new Map<number, RemsSourceSol[]>();
  for (const source of sourceProducts) productsBySol.set(source.sol, [...(productsBySol.get(source.sol) ?? []), source]);
  const solSummaries = [...productsBySol.entries()].sort(([a], [b]) => a - b).map(([sol, sources]) => summarizeSol(sol, sources));
  const validSolNumbers = solSummaries.filter((row) => row.validSampleCount > 0).map((row) => row.sol);
  const firstLs = solSummaries[0].solarLongitudeDegrees;
  const ordered = [...solSummaries].sort((a, b) => a.sol - b.sol);
  let previousLs = firstLs; let year = 0;
  for (const row of ordered) {
    if (row.sol !== ordered[0].sol && row.solarLongitudeDegrees + 180 < previousLs) year++;
    row.marsYearIndex = year;
    previousLs = row.solarLongitudeDegrees;
  }
  const validSols = ordered.filter((row) => row.validSampleCount > 0);
  const binSummaries = Array.from({ length: 12 }, (_, index) => {
    const start = index * 30; const end = start + 30;
    const rows = validSols.filter((row) => row.solarLongitudeDegrees >= start && row.solarLongitudeDegrees < end);
    const summarize = (key: "sampleMeanK" | "observedSampleMinimumK" | "observedSampleMaximumK" | "observedSampleRangeK") => {
      const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return { q25: quantile(values, 0.25), median: quantile(values, 0.5), q75: quantile(values, 0.75), validSolCount: values.length };
    };
    return {
      bin: `${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`, startDegrees: start, endDegreesExclusive: end,
      perSolSampleMeanK: summarize("sampleMeanK"), perSolObservedSampleMinimumK: summarize("observedSampleMinimumK"),
      perSolObservedSampleMaximumK: summarize("observedSampleMaximumK"), perSolObservedSampleRangeK: summarize("observedSampleRangeK"),
      sampledSolTemperatureDistributionK: { q25: quantile(rows.flatMap((row) => row.validSampleTemperatureK), 0.25), median: quantile(rows.flatMap((row) => row.validSampleTemperatureK), 0.5), q75: quantile(rows.flatMap((row) => row.validSampleTemperatureK), 0.75), validSampleCount: rows.reduce((sum, row) => sum + row.validSampleCount, 0), sampledSolCount: rows.length },
      validSampleCount: rows.reduce((sum, row) => sum + row.validSampleCount, 0), rejectedSampleCount: rows.reduce((sum, row) => sum + row.rejectedSampleCount, 0),
      solIds: rows.map((row) => row.sol),
    };
  });
  const allValues = validSols.map((row) => row.sampleMeanK).filter((value): value is number => typeof value === "number");
  const earthComparisons = input.expectedPowerSiteIds.map((siteId) => {
    const history = input.powerHistories[siteId];
    if (!history) throw new Error(`Expected stored NASA POWER history is missing for ${siteId}.`);
    const earth = summarizePowerHistory(history);
    return {
      siteId, status: "ambiguous" as const, method: "Unpaired descriptive distribution juxtaposition; no date alignment and no value subtraction; no suitability inference or ranking.",
      mars: { provider: "NASA PDS Atmospheres Node / Curiosity REMS", measurementType: "In-situ rover ambient-air-temperature estimate; per-sol mean of QC-filtered MODRDR samples", parameter: "AMBIENT_TEMP", unit: "K", validSolCount: validSols.length, validSampleCount: validSols.reduce((sum, row) => sum + row.validSampleCount, 0), q25K: quantile(allValues, 0.25), medianK: quantile(allValues, 0.5), q75K: quantile(allValues, 0.75) },
      earth,
      limitations: ["REMS is an in-situ estimate from sensors on the rover mast with irregular within-sol session sampling; NASA POWER T2M is a gridded/model-derived daily 2 m product.", "The two records cover different periods and are not same-time observations; no numerical delta is calculated.", "REMS observed sample extrema are not guaranteed full-sol daily extrema.", "The juxtaposition is descriptive context, not analog confirmation or a mission-suitability result."],
    };
  });
  const dimensions = (input.marsMissionProfile.dimensions ?? []).map((dimension: any) => ({
    dimensionId: dimension.id, name: dimension.name,
    marsObservationStatus: dimension.id === "climate" ? "partial_temperature_only" : "no_mars_observational_evidence_in_scope",
    note: dimension.id === "climate" ? "REMS ambient-air temperature samples are present. Other climate factors are outside this integration and are not implied by temperature coverage." : "No Mars observational dataset for this dimension is included in this milestone.",
  }));
  const missionEvidenceGaps = (input.marsMissionProfile.missions ?? []).map((mission: any) => ({
    missionId: mission.id, missionName: mission.name, objective: mission.objective,
    requiredFactors: mission.requiredFactorIds.map((factorId: string) => {
      const factor = input.marsMissionProfile.dimensions.flatMap((dimension: any) => dimension.factors.map((item: any) => ({ ...item, dimensionId: dimension.id, dimensionName: dimension.name }))).find((item: any) => item.id === factorId);
      if (!factor) throw new Error(`Mission ${mission.id} references unknown factor ${factorId}.`);
      const thermal = ["air_temperature_daily_mean", "air_temperature_extremes", "daily_temperature_range"].includes(factorId);
      return { factorId, name: factor.name, dimensionId: factor.dimensionId, dimensionName: factor.dimensionName,
        status: thermal ? "ambiguous" : "unavailable",
        marsEvidence: thermal ? "REMS MODRDR ambient air-temperature samples are available as a separate Mars observation; they do not satisfy the existing Earth-factor definition or form a compatible paired comparison." : "No matching Mars observational evidence was integrated for this factor.",
        earthEvidence: (factor.evidenceAvailability?.availableSiteIds ?? []).length ? `${factor.evidenceAvailability.provider ?? "Configured Earth source"}: ${factor.evidenceAvailability.dataset ?? "Earth reference evidence"}` : "No matching Earth evidence recorded in the current profile.",
        limitation: thermal ? "REMS is rover-mounted, irregularly sampled in-situ/model-corrected ambient temperature; Earth T2M is gridded daily 2 m data. No direct value difference is reported." : "Missing or out-of-scope evidence is not evidence that the environmental factor is absent.",
        nextEvidenceNeeded: thermal ? "Define a comparable sampling and measurement-height basis before any factor-level Mars/Earth comparison." : (factor.nextEvidenceNeed ?? "Select and validate a Mars observation and compatible Earth measurement for this factor."),
      };
    }),
    nonGoals: ["No readiness or suitability score", "No ranking", "No confirmation that an Earth location is a Mars analog"],
  }));
  const sourceRecords = solSummaries.reduce((sum, row) => sum + row.sourceRecordCount, 0);
  const validSamples = solSummaries.reduce((sum, row) => sum + row.validSampleCount, 0);
  const rejectedSamples = sourceRecords - validSamples;
  const confidenceCharacterCounts = Array.from({ length: 9 }, (_, index) => solSummaries.reduce((counts, row) => {
    for (const [code, count] of Object.entries(row.confidenceCodeCounts)) { const flag = code[index] ?? "?"; counts[flag] = (counts[flag] ?? 0) + count; }
    return counts;
  }, {} as Record<string, number>));
  const unknownContextFlagRecordCount = solSummaries.reduce((sum, row) => sum + Object.entries(row.confidenceCodeCounts).reduce((count, [code, n]) => count + (code.slice(0, 7).includes("X") ? n : 0), 0), 0);
  const artifact = {
    schemaVersion: REMS_SCHEMA_VERSION, extractionVersion: REMS_EXTRACTION_VERSION, generatedAt: input.retrievedAt,
    status: validSamples ? "available" : "no_samples_passed_quality_filter",
    dataset: { ...REMS_SOURCE, productVersion: "PDS3 dataset V1.0; PDS4 converted bundle label version 1.0", volumeDescription: "PDS Atmospheres mslrem_1001; retrieved MODRDR and matching product labels for selected sols only" },
    measurement: { parameter: "AMBIENT_TEMP", name: "Estimated ambient air temperature", unit: "K", type: "In-situ rover-mounted measurement estimate, processed/model-corrected MODRDR", groundTemperatureIncluded: false, humidityIncluded: false, pressureContextOnly: true },
    solarLongitude: { property: "planetocentric/areocentric solar longitude Ls", sourceStatus: "derived_from_PDS4_product_UTC_interval_midpoint", method: "NASA GISS Mars24 algorithm based primarily on Allison and McEwen (2000), with published perturber terms and UTC-to-TT offsets; one Ls is derived at the midpoint of each PDS4 product start_date_time/stop_date_time UTC interval and assigned to its sol rows. REMS counter timestamps are not independently converted to UTC.", sourceUrl: REMS_SOURCE.solarLongitudeMethodUrl, binWidthDegrees: 30, bins: "[0,30), [30,60), ... [330,360)" },
    qualityControl: { field: "AMBIENT_TEMP_CONFIDENCE_LEVEL", sourceDefinitionUrl: REMS_SOURCE.datasetUrl, productLabelDefinition: "Nine characters, byte 0 leftmost: byte 7 = operational-range error below 5 K; byte 8 = observation reliability.", sourceSemantics: "PDS code characters represent documented quality factors; 1=good, 0=bad, X=unknown. Context flags are preserved, and are not all treated as air-temperature acceptance gates.", terramatchFilter: "Accept only a finite non-sentinel AMBIENT_TEMP value, a nine-character [01X] confidence code, byte 7 equal to 1 (error within operational range, <5 K), and byte 8 equal to 1 (observation reliable). This explicit two-flag rule is a TerraMatch filter, not a PDS-published single quality threshold.", unknownContextFlagRecordCount, confidenceCharacterCounts, rejectedSamplesAreNot: "Rejected records are not interpreted as zero or as evidence of absence.", validSampleCount: validSamples, rejectedSampleCount: rejectedSamples,
      rejectionCounts: solSummaries.reduce((acc, row) => ({ missingTemperature: acc.missingTemperature + row.rejectionCounts.missingTemperature, unknownOrMalformedConfidence: acc.unknownOrMalformedConfidence + row.rejectionCounts.unknownOrMalformedConfidence, nonOptimalConfidence: acc.nonOptimalConfidence + row.rejectionCounts.nonOptimalConfidence }), { missingTemperature: 0, unknownOrMalformedConfidence: 0, nonOptimalConfidence: 0 }) },
    coverage: { sourceRecordCount: sourceRecords, sourceProductCount: sourceProducts.length, plannedSolIds: input.plannedSolIds ?? solSummaries.map((row) => row.sol), noProductSolIds: input.noProductSolIds ?? [], noProductSolDetails: input.noProductSolDetails ?? [], selectedSolCount: solSummaries.length, validSolCount: validSolNumbers.length, firstSelectedSol: solSummaries[0].sol, lastSelectedSol: solSummaries.at(-1)!.sol, selectedSolIds: solSummaries.map((row) => row.sol), lsBinsWithValidSamples: binSummaries.filter((bin) => bin.validSampleCount > 0).map((bin) => bin.bin), sourceCoverageDescription: "Focused seasonal sample: one selected sol per 30-degree Ls bin in a central archived Mars year. Bin quantiles describe accepted rows from the selected sol(s), not between-sol or multi-year climate variability; this is not a continuous archive or full climatology." },
    summary: { perSolMeanTemperatureDistribution: { unit: "K", perSolCount: allValues.length, q25: quantile(allValues, 0.25), median: quantile(allValues, 0.5), q75: quantile(allValues, 0.75) }, solarLongitudeBins: binSummaries },
    solSummaries: solSummaries.map(({ validSampleTemperatureK: _privateValues, ...summary }) => summary), earthReferenceComparisons: earthComparisons, evidenceDimensions: dimensions, missionEvidenceGaps,
    provenance: { provider: "NASA Planetary Data System Atmospheres Node", retrievedAt: input.retrievedAt, retrievalMethod: "Focused HTTP download of selected per-sol MODRDR ASCII tables and PDS4 XML labels; raw files kept outside repository.", extractionVersion: REMS_EXTRACTION_VERSION, rawFiles: sourceProducts.map((source) => ({ sol: source.sol, productId: source.sourceProductId ?? null, productUrl: source.productUrl, sourceSha256: source.sourceSha256, labelSha256: source.labelSha256, retrievedAt: source.retrievedAt ?? input.retrievedAt, ...productUtcInterval(source) })) },
    scientificLimitations: ["REMS MODRDR ambient air temperature is a processed/model-corrected rover-mast estimate, not ground temperature.", "PDS says REMS sampling is nominally 1 Hz during sessions, typically five minutes per hour plus additional one-hour sessions; temporal coverage is irregular within a sol.", "Observed sample minimum/maximum/range reflect only accepted samples actually present, not necessarily full-sol extrema.", "Ls is derived from UTC timestamps with NASA GISS Mars24 equations; it is not supplied as a field in the selected MODRDR table.", "NASA POWER T2M is gridded/model-derived at 2 m; Mars REMS and Earth values are not synchronized or measurement-height harmonized.", "No humidity comparison is made; measurement definitions are not evaluated in this integration. Pressure is not part of this temperature product and has no matching Earth counterpart here.", "No overall score, confidence percentage, ranking, or mission-suitability conclusion is produced."],
  };
  return artifact;
}

export function validateRemsAirTemperatureArtifact(value: any, expectedSiteIds = ["GKC", "GKB", "WDE", "KHA", "RTI", "DALL", "DAL", "AHS-GH"]): string[] {
  const errors: string[] = [];
  if (!value || value.schemaVersion !== REMS_SCHEMA_VERSION || value.extractionVersion !== REMS_EXTRACTION_VERSION) errors.push("REMS schema or extraction version is invalid.");
  if (value?.dataset?.datasetId !== REMS_SOURCE.datasetId || value?.dataset?.volumeId !== REMS_SOURCE.volumeId) errors.push("REMS source dataset/volume identity is invalid.");
  if (!Array.isArray(value?.solSummaries) || value.solSummaries.length !== value?.coverage?.selectedSolCount) errors.push("REMS sol summaries do not match coverage metadata.");
  if (!Array.isArray(value?.coverage?.plannedSolIds) || !Array.isArray(value?.coverage?.noProductSolDetails) || value.coverage.noProductSolIds?.length !== value.coverage.noProductSolDetails.length || (value.coverage.noProductSolDetails ?? []).some((item: any) => !value.coverage.noProductSolIds.includes(item.sol) || !item.reason)) errors.push("Unavailable planned product sols lack specific retrieval-status metadata.");
  if (!Array.isArray(value?.summary?.solarLongitudeBins) || value.summary.solarLongitudeBins.length !== 12) errors.push("Exactly twelve 30-degree Ls bins are required.");
  if ((value?.summary?.solarLongitudeBins ?? []).some((bin: any) => !Number.isFinite(bin.sampledSolTemperatureDistributionK?.q25) && bin.sampledSolTemperatureDistributionK?.validSampleCount > 0 || bin.sampledSolTemperatureDistributionK?.validSampleCount !== bin.validSampleCount)) errors.push("Ls-bin sample quantiles or accepted-sample counts are inconsistent.");
  if (value?.coverage?.sourceRecordCount !== value?.qualityControl?.validSampleCount + value?.qualityControl?.rejectedSampleCount) errors.push("Source, accepted, and rejected sample counts do not balance.");
  if (!value?.qualityControl?.terramatchFilter?.includes("byte 7 equal to 1") || !value?.qualityControl?.terramatchFilter?.includes("byte 8 equal to 1")) errors.push("The documented REMS operational-range and reliability QC filter is missing.");
  if (!Array.isArray(value?.earthReferenceComparisons) || JSON.stringify(value.earthReferenceComparisons.map((row: any) => row.siteId).sort()) !== JSON.stringify([...expectedSiteIds].sort())) errors.push("Earth comparison site IDs do not match the expected stored POWER histories.");
  if ((value?.earthReferenceComparisons ?? []).some((row: any) => row.status !== "ambiguous" || row.method?.includes("no value subtraction") !== true || row.earth?.provider !== "NASA POWER" || row.earth?.parameter !== "T2M")) errors.push("Earth/Mars thermal distribution boundary is invalid.");
  if ((value?.earthReferenceComparisons ?? []).some((row: any) => row.delta !== undefined || row.mars?.delta !== undefined || row.earth?.delta !== undefined)) errors.push("A direct Earth/Mars value difference is not permitted for these incompatible distributions.");
  if ((value?.earthReferenceComparisons ?? []).some((row: any) => row.mars?.parameter !== "AMBIENT_TEMP" || row.mars?.unit !== "K" || row.mars?.measurementType?.toLowerCase().includes("ground") === true)) errors.push("REMS ambient-air measurement classification is invalid.");
  if ((value?.missionEvidenceGaps ?? []).some((mission: any) => mission.requiredFactors.some((factor: any) => ["air_temperature_daily_mean", "air_temperature_extremes", "daily_temperature_range"].includes(factor.factorId) && factor.status !== "ambiguous"))) errors.push("REMS temperature evidence must remain an ambiguous cross-source comparison.");
  if ((value?.provenance?.rawFiles ?? []).some((file: any) => !/^https:\/\//.test(file.productUrl ?? "") || !/^[a-f0-9]{64}$/i.test(file.sourceSha256 ?? "") || !/^[a-f0-9]{64}$/i.test(file.labelSha256 ?? "") || !Number.isFinite(Date.parse(file.startUtc ?? "")) || !Number.isFinite(Date.parse(file.stopUtc ?? "")) || !Number.isFinite(Date.parse(file.retrievedAt ?? "")))) errors.push("A source product URL, retrieval timestamp, UTC interval, or SHA-256 provenance value is invalid.");
  const serialized = JSON.stringify(value ?? {});
  if (/("(similarity|score|ranking|rank|confidencePercent|readinessScore)"\s*:)/i.test(serialized)) errors.push("A prohibited overall score/rank/confidence field is present.");
  if (/("rawSamples"|"rawPayload"|"rawRecordText")\s*:/.test(serialized)) errors.push("Raw PDS records must not be embedded in the derived artifact.");
  return errors;
}

export function sha256Hex(content: string | Uint8Array): string { return createHash("sha256").update(content as any).digest("hex"); }
