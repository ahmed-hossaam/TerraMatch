import test from "node:test";
import assert from "node:assert/strict";
import { compareCandidateClimate } from "../src/comparison/candidate-climate.js";

function history(locationId: string, rows: unknown[], parameters = ["T2M", "RH2M"]) {
  return { provider: "NASA POWER", locationId, parameters, actualObservationPeriod: { start: "2001-01-01", end: "2001-01-03" }, daily: rows } as any;
}

test("candidate climate comparison uses only matching valid dates and same-unit NASA POWER factors", () => {
  const a = history("A", [
    { date: "2001-01-01", measurements: { T2M: { value: 10, unit: "°C", qualityStatus: "valid" }, RH2M: { value: 20, unit: "%", qualityStatus: "valid" } } },
    { date: "2001-01-02", measurements: { T2M: { value: 11, unit: "°C", qualityStatus: "valid" }, RH2M: { value: 21, unit: "%", qualityStatus: "valid" } } },
    { date: "2001-01-03", measurements: { T2M: { value: null, unit: "°C", qualityStatus: "missing" } } },
  ]);
  const b = history("B", [
    { date: "2001-01-01", measurements: { T2M: { value: 12, unit: "°C", qualityStatus: "valid" } } },
    { date: "2001-01-03", measurements: { T2M: { value: 14, unit: "°C", qualityStatus: "valid" } } },
  ]);
  const result = compareCandidateClimate(a, b);
  assert.equal(result.status, "descriptive");
  const temperature = result.factors.find((factor) => factor.parameterId === "T2M");
  assert.equal(temperature?.status, "compared");
  assert.equal(temperature?.pairedObservationCount, 1);
  assert.equal(temperature?.period?.start, "2001-01-01");
  assert.equal(temperature?.differenceBMinusA?.mean, 2);
  assert.equal(result.factors.find((factor) => factor.parameterId === "RH2M")?.status, "unavailable");
  assert.equal("score" in result, false);
});

test("candidate comparison preserves gridded source support and flags identical paired values", () => {
  const a = { ...history("A", [{ date: "2001-01-01", measurements: { T2M: { value: 10, unit: "°C", qualityStatus: "valid" } } }], ["T2M"]), provenance: { spatialResolution: "0.5° × 0.625° gridded product", temporalResolution: "Daily" } };
  const b = history("B", [{ date: "2001-01-01", measurements: { T2M: { value: 10, unit: "°C", qualityStatus: "valid" } } }], ["T2M"]);
  const result = compareCandidateClimate(a, b);
  assert.equal(result.factors[0].identicalMatchedValues, true);
  assert.equal(result.records.candidateA.spatialResolution, "0.5° × 0.625° gridded product");
  assert.equal(result.records.candidateA.temporalResolution, "Daily");
});

test("candidate climate comparison rejects incompatible provider data and reports no shared factors", () => {
  assert.throws(() => compareCandidateClimate(history("A", []), { ...history("B", []), provider: "Other" }), /Both candidates/);
  const a = history("A", [{ date: "2001-01-01", measurements: { T2M: { value: 10, unit: "°C", qualityStatus: "valid" } } }], ["T2M"]);
  const b = history("B", [{ date: "2001-01-01", measurements: { T2M: { value: 283, unit: "K", qualityStatus: "valid" } } }], ["T2M"]);
  const result = compareCandidateClimate(a, b);
  assert.equal(result.status, "unavailable");
  assert.equal(result.factors[0].status, "unavailable");
});
