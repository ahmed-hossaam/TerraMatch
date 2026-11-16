import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, sep, isAbsolute, extname } from "node:path";
import { createVercelArtifactStoreFromEnvironment } from "./storage/vercel-json-artifact-store.mjs";

const root = process.cwd();
const dataRoot = resolve(root, "data");
if (!process.env.DATABASE_URL || !process.env.BLOB_STORE_ID) {
  throw new Error("This migration requires DATABASE_URL and BLOB_STORE_ID in the process environment.");
}
const deploymentEnvironment = process.env.VERCEL_ENV;
if (!['preview', 'production'].includes(deploymentEnvironment)) {
  throw new Error("Data seeding must target an explicitly selected Vercel Preview or Production environment.");
}
if (deploymentEnvironment === "preview" && process.env.TERRAMATCH_PREVIEW_DB_ISOLATED !== "true") {
  throw new Error("Preview data migration is disabled until the Neon endpoint is verified as an isolated non-production branch and TERRAMATCH_PREVIEW_DB_ISOLATED=true is explicitly set.");
}
if (deploymentEnvironment === "production" && process.env.TERRAMATCH_PRODUCTION_MIGRATION_APPROVED !== "true") {
  throw new Error("Production data migration requires the explicit TERRAMATCH_PRODUCTION_MIGRATION_APPROVED=true release gate.");
}
// Use Neon's direct endpoint for the one-time, sequential bulk seed when the
// connected integration provides it. Request handlers keep the pooled URL.
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
let hasGitMetadata = true;
try { execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, stdio: "ignore" }); }
catch { hasGitMetadata = false; }
if (hasGitMetadata) {
  try { execFileSync("git", ["diff", "--quiet", "--", "data"], { cwd: root, stdio: "ignore" }); }
  catch { throw new Error("Refusing to migrate because tracked scientific data has local modifications. Review or commit those changes first."); }
}

const trackedManifest = JSON.parse((await readFile(resolve(root, "scripts/migration/vercel-seed-manifest.json"), "utf8")).replace(/^\uFEFF/, ""));
if (!Array.isArray(trackedManifest) || trackedManifest.some((path) => typeof path !== "string" || !path.startsWith("data/") || path.endsWith(".tmp") || path.includes("\\") || path.split("/").includes(".."))) {
  throw new Error("The checked-in Vercel data seed manifest is invalid.");
}
const tracked = [...new Set(trackedManifest)].sort();
const store = await createVercelArtifactStoreFromEnvironment();
await store.ensureSchema();
let stored = 0;
let totalBytes = 0;
let importedJobs = 0;
let climatePageCount = 0;
const manifest = [];
const checksums = new Map();

for (const repositoryPath of tracked) {
  const absolutePath = resolve(root, repositoryPath);
  const rel = relative(dataRoot, absolutePath);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Unsafe tracked data path: ${repositoryPath}`);
  const bytes = await readFile(absolutePath);
  const key = rel.split(sep).join("/");
  const size = (await stat(absolutePath)).size;
  totalBytes += size;
  checksums.set(key, { sha256: createHash("sha256").update(bytes).digest("hex"), size });
  const mutable = /(^|\/)(latest\.json|validation-report\.json)$/.test(key);
  try {
    if (mutable) await store.writeBytesAtomic(key, bytes);
    else await store.writeBytesImmutable(key, bytes);
    stored += 1;
  } catch (error) {
    if (/Immutable artifact already exists with different content/.test(String(error?.message))) throw error;
    throw new Error(`Failed to migrate ${key}: ${error?.message ?? error}`);
  }
  if (/^app-runtime\/jobs\/[a-f0-9-]+\.json$/i.test(key)) {
    const job = JSON.parse(bytes.toString("utf8"));
    if (await store.importLegacyJob(job)) importedJobs += 1;
  }
  if (/^processed\/climate\/candidates\/[^/]+-daily\.json$/.test(key)) {
    const history = JSON.parse(bytes.toString("utf8"));
    const dailyEntries = Object.entries(history.daily ?? {}).sort(([left], [right]) => left.localeCompare(right));
    const pageSize = 400;
    const pageRoot = key.replace(/-daily\.json$/, "-daily-pages");
    const pages = [];
    for (let offset = 0; offset < dailyEntries.length; offset += pageSize) {
      const entries = dailyEntries.slice(offset, offset + pageSize);
      const file = `${String(pages.length).padStart(4, "0")}.json`;
      await store.writeJsonImmutable(`${pageRoot}/${file}`, { daily: Object.fromEntries(entries) });
      pages.push({ file, offset, count: entries.length });
      climatePageCount += 1;
    }
    const { daily: _daily, ...metadata } = history;
    await store.writeJsonImmutable(`${pageRoot}/index.json`, { ...metadata, recordCount: dailyEntries.length, pageSize, pages });
  }
  manifest.push({ key, size });
}

// Verify every key's durable metadata against the exact checked-in bytes, then
// read representative small and large artifacts back through private Blob.
const expectedKeys = [...checksums.keys()];
const persisted = await store.pool.query(
  "SELECT artifact_key, sha256, byte_size FROM terramatch_artifacts WHERE artifact_key = ANY($1::text[])",
  [expectedKeys],
);
if (persisted.rows.length !== expectedKeys.length) throw new Error(`Seed verification found ${persisted.rows.length} of ${expectedKeys.length} artifact metadata records.`);
for (const row of persisted.rows) {
  const expected = checksums.get(row.artifact_key);
  if (!expected || row.sha256 !== expected.sha256 || Number(row.byte_size) !== expected.size) {
    throw new Error(`Seed verification checksum or size mismatch for ${row.artifact_key}.`);
  }
}
const largestComparisonRun = [...checksums.entries()]
  .filter(([key]) => /^processed\/comparison-runs\/[a-f0-9-]{16,64}\.json$/i.test(key))
  .sort((left, right) => right[1].size - left[1].size)[0]?.[0];
const readbackKeys = [
  "processed/reference-sites.json",
  "curation/reference-curation-v1.json",
  "evidence/evidence-registry-v1.json",
  "mission-profiles/mars-surface-v1.json",
  "processed/discovery-runs/latest.json",
  "processed/comparison-runs/latest.json",
  largestComparisonRun,
].filter((key) => key && checksums.has(key));
for (const key of readbackKeys) {
  const bytes = await store.readBytes(key);
  const expected = checksums.get(key);
  if (bytes.byteLength !== expected.size || createHash("sha256").update(bytes).digest("hex") !== expected.sha256) {
    throw new Error(`Seed Blob readback verification failed for ${key}.`);
  }
}

console.log(JSON.stringify({
  status: "complete",
  source: "tracked repository data files (temporary .tmp files excluded)",
  artifactCount: stored,
  totalBytes,
  importedLegacyJobCount: importedJobs,
  climateHistoryPageCount: climatePageCount,
  metadataChecksumVerification: "passed",
  blobReadbackKeys: readbackKeys,
  databaseSchema: "terramatch_artifacts, terramatch_jobs, terramatch_latest_pointers",
  manifest,
}, null, 2));
