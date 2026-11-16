import { readFile } from "node:fs/promises";
import { validateRemsAirTemperatureArtifact } from "../src/mars/rems.js";

const artifactPath = "data/processed/mars/rems-air-temperature-v1.json";
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const errors = validateRemsAirTemperatureArtifact(artifact);
const [references, fixtures, profile, evidence, knownPower, ...supplementaryPower] = await Promise.all([
  "data/processed/reference-sites.json", "data/processed/candidate-points.json", "data/mission-profiles/mars-surface-v1.json",
  "data/evidence/evidence-registry-v1.json", "data/processed/climate/known-sites-daily.json",
  "data/processed/supplementary-evidence/DALL-climate.json", "data/processed/supplementary-evidence/DAL-climate.json", "data/processed/supplementary-evidence/AHS-GH-climate.json",
].map(async (path) => JSON.parse(await readFile(path, "utf8"))));
if ((Array.isArray(references) ? references : references.records ?? []).length !== 31) errors.push("The 31-reference inventory count changed.");
if ((Array.isArray(fixtures) ? fixtures : fixtures.records ?? []).length !== 3) errors.push("The three separate test fixtures count changed.");
if (profile.dimensions?.length !== 5 || profile.dimensions.flatMap((dimension: any) => dimension.factors ?? []).length !== 19 || profile.missions?.length !== 4) errors.push("Mars mission-profile dimensions, factors, or mission count changed.");
if (evidence.records?.length !== 589) errors.push("The unified evidence registry factor-row count changed.");
const powerById = new Map([...(knownPower ?? []), ...supplementaryPower].map((history: any) => [history.locationId, history]));
for (const id of ["GKC", "GKB", "WDE", "KHA", "RTI", "DALL", "DAL", "AHS-GH"]) {
  const history: any = powerById.get(id);
  if (!history || history.daily?.length !== 7305 || history.actualObservationPeriod?.start !== "2001-01-01" || history.actualObservationPeriod?.end !== "2020-12-31") errors.push(`${id}: stored NASA POWER history coverage does not match the verified 2001–2020 daily series.`);
}
if (errors.length) {
  console.error(JSON.stringify({ status: "invalid", artifactPath, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "valid", artifactPath, schemaVersion: artifact.schemaVersion,
    datasetId: artifact.dataset.datasetId, volumeId: artifact.dataset.volumeId,
    selectedSolCount: artifact.coverage.selectedSolCount, sourceProductCount: artifact.coverage.sourceProductCount,
    sourceRecordCount: artifact.coverage.sourceRecordCount, validSampleCount: artifact.qualityControl.validSampleCount,
    rejectedSampleCount: artifact.qualityControl.rejectedSampleCount,
    earthReferenceSiteIds: artifact.earthReferenceComparisons.map((row: any) => row.siteId),
    missionCount: artifact.missionEvidenceGaps.length,
  }, null, 2));
}
