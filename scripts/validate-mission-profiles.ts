import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { validateMissionProfile, validateBlindBenchmarkProtocol } from "../src/schemas/mission-profile.js";
import { validateRecords } from "../src/validation/records.js";

const json = async (path: string): Promise<any> => JSON.parse(await readFile(path, "utf8"));
const known = await json("data/processed/reference-sites.json");
const candidates = await json("data/processed/candidate-points.json");
const discovery = await json("data/processed/discovery-runs/latest.json").catch(() => ({ candidates: [] }));
const climate = await json("data/processed/climate/retrieval-report.json");
const terrain = await json("data/processed/terrain/validation-report.json");
const geology = await json("data/processed/geology/validation-report.json");
const supplementary = await json("data/processed/supplementary-evidence/retrieval-report.json");
const profile = await json("data/mission-profiles/mars-surface-v1.json");
const protocol = await json("data/benchmarks/blind-benchmark-protocol-v1.json");
const knownIds = known.map((record: any) => record.id);
const candidateIds = [...candidates.filter((record: any) => record.recordType === "candidate_region"), ...(discovery.candidates ?? [])].map((record: any) => record.id);
const fixtureIds = candidates.filter((record: any) => record.recordType === "test_fixture").map((record: any) => record.id);
const errors = [
  ...validateRecords(known).map((error) => `known records: ${error}`),
  ...validateRecords(candidates).map((error) => `candidate/fixture records: ${error}`),
  ...validateMissionProfile(profile).map((error) => `profile: ${error}`),
  ...validateBlindBenchmarkProtocol(protocol, knownIds, candidateIds, fixtureIds).map((error) => `protocol: ${error}`)
];
const successfulIds = (report: any, idField: string, status: string) => report.sites.filter((site: any) => site.status === status).map((site: any) => site[idField]).sort();
const supplementaryIds = (key:string) => supplementary.results.filter((site:any)=>site.status==="attempted"&&site.evidence?.[key]?.status==="success").map((site:any)=>site.siteId);
const retrievedClimate = [...new Set([...successfulIds(climate, "locationId", "success"), ...supplementaryIds("climate")])].sort();
const retrievedTerrain = [...new Set([...successfulIds(terrain, "locationId", "success"), ...supplementaryIds("terrain")])].sort();
const retrievedGeology = [...new Set([...successfulIds(geology, "locationId", "mapped"), ...supplementaryIds("geology")])].sort();
for (const [label, actual] of [["NASA POWER", retrievedClimate], ["Copernicus DEM", retrievedTerrain], ["GLiM", retrievedGeology]] as const) {
  if (JSON.stringify(actual) !== JSON.stringify(["AHS-GH", "DAL", "DALL", "GKB", "GKC", "KHA", "RTI", "WDE"])) errors.push(`${label} availability IDs differ from verified original and supplementary retrieval reports`);
}
const report = {
  schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), status: errors.length ? "invalid" : "valid",
  profileId: profile.profileId, profileVersion: profile.profileVersion, dimensionCount: profile.dimensions.length,
  factorCount: profile.dimensions.reduce((sum: number, dimension: any) => sum + dimension.factors.length, 0), missionCount: profile.missions.length,
  referenceCount: knownIds.length, candidateRegionCount: candidateIds.length, testFixtureCount: fixtureIds.length,
  verifiedRetrievedSiteIds: { climate: retrievedClimate, terrain: retrievedTerrain, geology: retrievedGeology },
  benchmark: { status: protocol.status, scientificValidationStatus: protocol.scientificValidationStatus, splitCreated: protocol.splitProposal.calibrationReferenceIds.length > 0 || protocol.splitProposal.heldOutReferenceIds.length > 0, executionStatus: protocol.evaluationPlan.executionStatus },
  errors
};
await mkdir("data/processed/mission-profiles", { recursive: true });
const temporary = `data/processed/mission-profiles/validation-report.${process.pid ?? "run"}.tmp`;
await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await rename(temporary, process.env.MISSION_PROFILE_VALIDATION_OUTPUT ?? "data/processed/mission-profiles/validation-report.json");
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
