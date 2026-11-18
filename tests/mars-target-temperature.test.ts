import test from "node:test";
import assert from "node:assert/strict";
import { createMarsTemperatureContext } from "../src/comparison/mars-target-temperature.js";

test("Earth POWER daily means and REMS per-sol means are summarized side by side in kelvin without a delta", () => {
  const result = createMarsTemperatureContext({
    provider: "NASA POWER",
    actualObservationPeriod: { start: "2001-01-01", end: "2001-01-02" },
    daily: [
      { date: "2001-01-01", measurements: { T2M: { value: 0, unit: "°C", qualityStatus: "valid" } } },
      { date: "2001-01-02", measurements: { T2M: { value: 10, unit: "°C", qualityStatus: "valid" } } },
      { date: "2001-01-03", measurements: { T2M: { value: -999, unit: "°C", qualityStatus: "missing" } } },
    ],
  }, {
    status: "available",
    dataset: { provider: "NASA PDS Atmospheres Node / Curiosity REMS", datasetId: "MSL-M-REMS-5-MODRDR-V1.0" },
    measurement: { parameter: "AMBIENT_TEMP", type: "Rover air temperature estimate", unit: "K" },
    solSummaries: [{ sol: 1718, sampleMeanK: 220, validSampleCount: 100 }, { sol: 1781, sampleMeanK: 230, validSampleCount: 120 }],
    coverage: { firstSelectedSol: 1718, lastSelectedSol: 1781 },
    qualityControl: { validSampleCount: 220, rejectedSampleCount: 50 },
  });
  assert.equal(result?.status, "ambiguous");
  assert.equal(result?.candidate.statistics.count, 2);
  assert.equal(result?.candidate.statistics.mean, 278.15);
  assert.equal(result?.target.statisticsAcrossSelectedSolMeans.count, 2);
  assert.equal(result?.target.statisticsAcrossSelectedSolMeans.median, 225);
  assert.equal(Object.hasOwn(result!, "difference"), false);
  assert.ok(result?.limitations.some((item) => /not a paired observation/i.test(item)));
});

test("Mars temperature context rejects incompatible provider units and absent REMS samples", () => {
  assert.throws(() => createMarsTemperatureContext({ provider: "Other", daily: [] }, {}), /not identified as NASA POWER/);
  assert.throws(() => createMarsTemperatureContext({ provider: "NASA POWER", daily: [{ measurements: { T2M: { value: 20, unit: "K", qualityStatus: "valid" } } }] }, { status: "available", measurement: { unit: "K" }, solSummaries: [{ sampleMeanK: 220, validSampleCount: 1 }] }), /expected degrees Celsius/);
  assert.equal(createMarsTemperatureContext({ provider: "NASA POWER", daily: [{ measurements: { T2M: { value: 20, unit: "°C", qualityStatus: "valid" } } }] }, { status: "available", measurement: { unit: "K" }, solSummaries: [] }), null);
});
