import { readFile, writeFile } from "node:fs/promises";
import { validateEvidenceRegistry } from "../src/evidence/validate.js";
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [references, fixtures, curation, registry, coverage, acquisitions] = await Promise.all([
  read("data/processed/reference-sites.json"), read("data/processed/candidate-points.json"), read("data/curation/reference-curation-v1.json"), read("data/evidence/evidence-registry-v1.json"), read("data/evidence/evidence-coverage-v1.json"), read("data/evidence/m2/normalized/site-acquisitions-v1.json"),
]);
const errors = validateEvidenceRegistry(registry, references.map((r: any) => r.id), fixtures.map((r: any) => r.id), curation.records);
if (coverage.siteCount !== 31 || coverage.factorCount !== 19 || coverage.coverage?.length !== 31 * 19) errors.push("coverage report must account for all 31 references and all 19 factors");
if (JSON.stringify([...coverage.eligibleSiteIds].sort()) !== JSON.stringify([...registry.policy.eligibleSiteIds].sort())) errors.push("coverage eligible IDs differ from registry policy");
if (JSON.stringify(registry.supplementalRecords?.map((row: any) => row.evidenceId).sort()) !== JSON.stringify(acquisitions.records?.map((row: any) => row.evidenceId).sort())) errors.push("unified supplemental evidence differs from the normalized M2 acquisition file");
if (coverage.supplementalRecordCount !== acquisitions.records?.length) errors.push("supplemental coverage count differs from normalized M2 acquisitions");
const report = { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), status: errors.length ? "invalid" : "valid", referenceCount: references.length, fixtureCount: fixtures.length, factorCount: coverage.factorCount, evidenceRecordCount: registry.records.length, supplementalEvidenceRecordCount: registry.supplementalRecords?.length ?? 0, acquisitionSourceRecordCount: acquisitions.records?.length ?? 0, supplementalSites: [...new Set((registry.supplementalRecords ?? []).map((row: any) => row.siteId))], eligibleSiteIds: registry.policy.eligibleSiteIds, excludedSiteIds: registry.policy.excludedSiteIds, stateCounts: coverage.evidenceStateCounts, errors };
await writeFile(process.env.EVIDENCE_VALIDATION_OUTPUT ?? "data/evidence/evidence-validation-v1.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
