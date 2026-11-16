import test from "node:test";
import assert from "node:assert/strict";
import { buildRemsAirTemperatureArtifact, marsSolarLongitudeDegrees, remsSolarLongitudeBin, validateRemsAirTemperatureArtifact, type RemsSourceSol } from "../src/mars/rems.js";

function productRow(timestamp: number, sol: number, temperature: string, qc: string) {
  const columns = Array.from({ length: 40 }, () => "0");
  columns[0] = String(timestamp); columns[1] = `"${String(sol).padStart(5, "0")}M13:00:00.000"`; columns[2] = `"${String(sol).padStart(5, "0")} 13:00:00"`;
  columns[15] = temperature; columns[16] = `"${qc}"`;
  return columns.join(",");
}
function pdsLabel(sol: number) {
  const fields = Array.from({ length: 17 }, (_, index) => `<Field_Character><name>${index === 15 ? "AMBIENT_TEMP" : index === 16 ? "AMBIENT_TEMP_CONFIDENCE_LEVEL" : `FIELD_${index + 1}`}</name></Field_Character>`).join("");
  return `<Product_Observational><start_date_time>2012-08-07T04:04:38.536Z</start_date_time><stop_date_time>2012-08-07T05:04:38.536Z</stop_date_time><Record_Character>${fields.replace('<name>AMBIENT_TEMP_CONFIDENCE_LEVEL</name>', '<name>AMBIENT_TEMP_CONFIDENCE_LEVEL</name><description>String; byte 7: Operational range (error &lt; 5 kelvin); byte 8: Observation reliability; 0 = unreliable; 1 = reliable.</description>')}</Record_Character></Product_Observational>`;
}
function source(sol: number, rows: string[]): RemsSourceSol {
  return { sol, tab: rows.join("\r\n"), labelXml: pdsLabel(sol), productUrl: `https://pds.example.test/SOL${sol}/RMD.TAB`, sourceSha256: "a".repeat(64), labelSha256: "b".repeat(64) };
}
const ids = ["GKC", "GKB", "WDE", "KHA", "RTI", "DALL", "DAL", "AHS-GH"];
function profile() {
  return {
    dimensions: [
      { id: "climate", name: "Climate", factors: ["air_temperature_daily_mean", "air_temperature_extremes", "daily_temperature_range", "relative_humidity", "wind_speed", "precipitation"].map((id) => ({ id, name: id, evidenceAvailability: { availableSiteIds: ids, provider: "NASA POWER", dataset: "Daily Point API", nextEvidenceNeed: "More observations" } })) },
      { id: "terrain", name: "Terrain", factors: [{ id: "slope", name: "Slope", evidenceAvailability: { availableSiteIds: [] } }] },
    ],
    missions: [
      { id: "thermal", name: "Thermal mission", objective: "Test thermal evidence", requiredFactorIds: ["air_temperature_daily_mean", "air_temperature_extremes"] },
      { id: "humidity", name: "Humidity mission", objective: "Test gap", requiredFactorIds: ["relative_humidity"] },
      { id: "terrain", name: "Terrain mission", objective: "Test gap", requiredFactorIds: ["slope"] },
      { id: "range", name: "Range mission", objective: "Test gap", requiredFactorIds: ["daily_temperature_range"] },
    ],
  };
}
function histories() {
  return Object.fromEntries(ids.map((id) => [id, { endpoint: "https://power.larc.nasa.gov/api/temporal/daily/point", actualObservationPeriod: { start: "2001-01-01", end: "2020-12-31" }, requestedCoordinate: { latitude: 1, longitude: 2 }, providerResponseCoordinate: { latitude: 1, longitude: 2 }, daily: [{ measurements: { T2M: { value: 10 } } }, { measurements: { T2M: { value: null } } }] }]));
}

test("NASA Mars24 Ls and 30-degree bins are bounded and deterministic", () => {
  const ls = marsSolarLongitudeDegrees(new Date("2012-08-07T04:04:38.536Z"));
  assert.ok(ls > 151 && ls < 152);
  assert.equal(remsSolarLongitudeBin(0), "000-030");
  assert.equal(remsSolarLongitudeBin(359.999), "330-360");
  assert.throws(() => remsSolarLongitudeBin(360));
});

test("REMS parser applies the label-defined temperature QC bytes and preserves accepted/rejected counts", () => {
  const rows = [
    productRow(397535244, 100, "266.00", "111111111"),
    productRow(397535245, 100, "-999.00", "UNK"),
    productRow(397535246, 100, "269.00", "1111X1111"),
    productRow(397535247, 100, "270.00", "101111111"),
    productRow(397535248, 100, "268.00", "111111111"),
    productRow(397535249, 100, "271.00", "111XX1101"),
    productRow(397535250, 100, "272.00", "111XX11X1"),
  ];
  const result = buildRemsAirTemperatureArtifact({ sourceProducts: [source(100, rows)], retrievedAt: "2026-11-16T00:00:00.000Z", powerHistories: histories(), expectedPowerSiteIds: ids, marsMissionProfile: profile() });
  assert.equal(result.coverage.sourceRecordCount, 7);
  assert.equal(result.qualityControl.validSampleCount, 4);
  assert.equal(result.qualityControl.rejectedSampleCount, 3);
  assert.deepEqual(result.qualityControl.rejectionCounts, { missingTemperature: 1, unknownOrMalformedConfidence: 1, nonOptimalConfidence: 1 });
  assert.equal(result.solSummaries[0].observedSampleMinimumK, 266);
  assert.equal(result.solSummaries[0].observedSampleMaximumK, 270);
  assert.equal(result.solSummaries[0].observedSampleRangeK, 4);
  assert.equal(result.summary.solarLongitudeBins.length, 12);
  assert.equal(validateRemsAirTemperatureArtifact(result, ids).length, 0);
});

test("REMS summaries preserve the two distinct sources and mark incompatible distribution juxtaposition ambiguous", () => {
  const result = buildRemsAirTemperatureArtifact({ sourceProducts: [source(100, [productRow(397535244, 100, "266", "111111111")])], retrievedAt: "2026-11-16T00:00:00.000Z", powerHistories: histories(), expectedPowerSiteIds: ids, marsMissionProfile: profile() });
  assert.deepEqual(result.earthReferenceComparisons.map((row) => row.siteId).sort(), [...ids].sort());
  assert.ok(result.earthReferenceComparisons.every((row) => row.status === "ambiguous" && row.mars.parameter === "AMBIENT_TEMP" && row.earth.parameter === "T2M"));
  assert.ok(result.earthReferenceComparisons.every((row) => row.earth.validObservationCount === 1 && row.earth.missingObservationCount === 1));
  assert.ok(result.missionEvidenceGaps.every((mission: any) => mission.requiredFactors.every((factor: any) => ["ambiguous", "unavailable"].includes(factor.status))));
  assert.ok(result.missionEvidenceGaps.find((mission: any) => mission.missionId === "thermal")?.requiredFactors.every((factor: any) => factor.status === "ambiguous"));
  assert.equal(JSON.stringify(result).includes("similarityScore"), false);
});

test("REMS artifact validator rejects invalid provenance, score fields, and direct cross-source temperature deltas", () => {
  const valid = buildRemsAirTemperatureArtifact({ sourceProducts: [source(100, [productRow(397535244, 100, "266", "111111111")])], retrievedAt: "2026-11-16T00:00:00.000Z", powerHistories: histories(), expectedPowerSiteIds: ids, marsMissionProfile: profile() });
  const invalid = structuredClone(valid) as any;
  invalid.score = 0.9;
  invalid.earthReferenceComparisons[0].status = "compared";
  invalid.earthReferenceComparisons[0].mars.delta = -3;
  invalid.provenance.rawFiles[0].sourceSha256 = "bad";
  const errors = validateRemsAirTemperatureArtifact(invalid, ids);
  assert.ok(errors.length >= 3);
});
