import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";

export const CONFLICTING_REPOSITORY_PATH = "data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv";
const BLOB_NAMESPACE = "terramatch/v1/objects/";
const REQUIRED_COLUMNS = {
  terramatch_artifacts: ["artifact_key", "blob_path", "sha256", "byte_size", "immutable", "created_at", "updated_at"],
  terramatch_latest_pointers: ["pointer_key", "artifact_key", "revision", "updated_at"],
  terramatch_jobs: ["job_id", "status", "artifact_key", "payload", "created_at", "updated_at"],
};

const SECRET_KEY = /(?:password|secret|token|authorization|credential|connection[_-]?string|database[_-]?url|blob[_-]?read[_-]?write[_-]?token)/i;
const SECRET_VALUE = /(postgres(?:ql)?:\/\/)[^@\s]+@/gi;
const JWT_VALUE = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;
const BEARER_VALUE = /\bBearer\s+[^\s,;]+/gi;
const QUERY_SECRET_VALUE = /([?&](?:access[_-]?token|token|api[_-]?key|secret|password)=)[^&#\s]+/gi;

export function sanitizeDiagnosticOutput(value) {
  if (typeof value === "string") return value.replace(SECRET_VALUE, "$1[redacted]@").replace(JWT_VALUE, "[redacted-token]").replace(BEARER_VALUE, "Bearer [redacted]").replace(QUERY_SECRET_VALUE, "$1[redacted]");
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticOutput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, child]) => [key, sanitizeDiagnosticOutput(child)]));
  }
  return value;
}

export function getIncidentManifestPaths(manifest) {
  if (!Array.isArray(manifest) || manifest.some((path) => typeof path !== "string" || !path.startsWith("data/") || path.includes("\\") || path.split("/").includes(".."))) {
    throw new Error("Seed manifest is invalid.");
  }
  const sorted = [...new Set(manifest)].sort();
  const conflictIndex = sorted.indexOf(CONFLICTING_REPOSITORY_PATH);
  if (conflictIndex !== 46) throw new Error(`Expected the incident artifact at manifest entry 47; found ${conflictIndex < 0 ? "no entry" : `entry ${conflictIndex + 1}`}.`);
  return { sorted, preceding: sorted.slice(0, 46), conflictIndex };
}

async function readBlobBytes(blob, pathname, storeId) {
  const result = await blob.get(pathname, { access: "private", storeId, useCache: false });
  if (!result || !result.stream) return { exists: false };
  const chunks = [];
  for await (const chunk of Readable.fromWeb(result.stream)) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  const metadata = result.blob ?? {};
  return {
    exists: true,
    actualSha256: createHash("sha256").update(bytes).digest("hex"),
    actualByteSize: bytes.byteLength,
    metadata: {
      pathname: metadata.pathname ?? pathname,
      contentType: metadata.contentType ?? null,
      size: metadata.size ?? null,
      etag: metadata.etag ?? null,
      uploadedAt: metadata.uploadedAt ? new Date(metadata.uploadedAt).toISOString() : null,
    },
  };
}

async function inspectBlobListing(listBlobs, storeId) {
  const blobs = [];
  let cursor;
  let complete = true;
  const maxPages = 20;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await listBlobs({ prefix: BLOB_NAMESPACE, limit: 1000, ...(cursor ? { cursor } : {}), storeId });
    for (const blob of result.blobs ?? []) {
      blobs.push({ pathname: blob.pathname, size: blob.size, etag: blob.etag, uploadedAt: blob.uploadedAt ? new Date(blob.uploadedAt).toISOString() : null });
    }
    if (!result.hasMore) return { available: true, complete: true, blobs };
    cursor = result.cursor;
    if (!cursor) break;
  }
  complete = false;
  return { available: true, complete, blobs, note: "Blob listing exceeded the diagnostic page bound." };
}

export async function runReadOnlyArtifactDiagnostic({ pool, blob, listBlobs, storeId, root = process.cwd(), migrationStartedAt = null }) {
  if (!pool || !blob || !listBlobs || !storeId) throw new Error("Database and private Blob integrations are required.");
  const manifest = JSON.parse((await readFile(resolve(root, "scripts/migration/vercel-seed-manifest.json"), "utf8")).replace(/^\uFEFF/, ""));
  const { sorted, preceding, conflictIndex } = getIncidentManifestPaths(manifest);
  const conflictFile = resolve(root, CONFLICTING_REPOSITORY_PATH);
  const repoBytes = await readFile(conflictFile);
  const repoFileStat = await stat(conflictFile);
  const provenanceManifest = JSON.parse((await readFile(resolve(root, "data/evidence/m2/retrieval-manifest-v1.json"), "utf8")).replace(/^\uFEFF/, ""));
  const provenance = (provenanceManifest.attempts ?? []).find((attempt) => attempt.rawArtifactPath === CONFLICTING_REPOSITORY_PATH) ?? null;
  const repositoryArtifact = {
    repositoryPath: CONFLICTING_REPOSITORY_PATH,
    sha256: createHash("sha256").update(repoBytes).digest("hex"),
    byteSize: repoFileStat.size,
    configuredBlobContentType: CONFLICTING_REPOSITORY_PATH.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream",
    provenancePath: "data/evidence/m2/retrieval-manifest-v1.json",
    provenance: provenance ? {
      schemaVersion: provenanceManifest.schemaVersion ?? null,
      sourceId: provenance.sourceId,
      sourceUrl: provenance.url,
      downloadUrl: provenance.downloadUrl,
      attemptedAt: provenance.attemptedAt,
      httpStatus: provenance.httpStatus,
      outcome: provenance.outcome,
    } : null,
  };
  const artifactKeys = [...preceding, sorted[conflictIndex]].map((path) => path.slice("data/".length));

  const client = await pool.connect();
  let databaseSnapshot;
  try {
    await client.query("BEGIN READ ONLY");
    const transaction = await client.query("SELECT current_setting('transaction_read_only') AS read_only, current_database() AS database_name");
    if (transaction.rows[0]?.read_only !== "on") throw new Error("PostgreSQL did not enter a read-only transaction.");
    const schema = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position
    `, [Object.keys(REQUIRED_COLUMNS)]);
    const columnsByTable = new Map();
    for (const column of schema.rows) {
      if (!columnsByTable.has(column.table_name)) columnsByTable.set(column.table_name, []);
      columnsByTable.get(column.table_name).push(column.column_name);
    }
    const missing = Object.entries(REQUIRED_COLUMNS).flatMap(([table, required]) => required
      .filter((column) => !columnsByTable.get(table)?.includes(column))
      .map((column) => `${table}.${column}`));
    if (missing.length) throw new Error(`Production artifact schema is missing required columns: ${missing.join(", ")}`);

    const total = await client.query("SELECT count(*)::bigint AS artifact_count, COALESCE(sum(byte_size), 0)::numeric AS total_bytes FROM terramatch_artifacts");
    const artifacts = await client.query(`
      SELECT artifact_key, blob_path, sha256, byte_size, immutable, created_at, updated_at
      FROM terramatch_artifacts WHERE artifact_key = ANY($1::text[])
    `, [artifactKeys]);
    const allPaths = await client.query("SELECT artifact_key, blob_path FROM terramatch_artifacts");
    const pointers = await client.query(`
      SELECT pointer_key, artifact_key, revision, updated_at
      FROM terramatch_latest_pointers WHERE artifact_key = ANY($1::text[])
    `, [artifactKeys]);
    const jobs = await client.query(`
      SELECT job_id, status, artifact_key, created_at, updated_at
      FROM terramatch_jobs
      WHERE artifact_key = ANY($1::text[])
         OR EXISTS (SELECT 1 FROM unnest($1::text[]) AS k WHERE position(k in COALESCE(payload::text, '')) > 0)
    `, [artifactKeys]);
    databaseSnapshot = {
      transactionReadOnly: transaction.rows[0].read_only === "on",
      databaseName: transaction.rows[0].database_name,
      schema: schema.rows,
      totalArtifacts: { count: String(total.rows[0].artifact_count), byteSize: String(total.rows[0].total_bytes) },
      affectedArtifacts: artifacts.rows,
      missingAffectedArtifactKeys: artifactKeys.filter((key) => !artifacts.rows.some((row) => row.artifact_key === key)),
      latestPointers: pointers.rows,
      jobs: jobs.rows,
      allArtifactBlobPaths: allPaths.rows,
    };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }

  let listing;
  try { listing = await inspectBlobListing(listBlobs, storeId); }
  catch (error) { listing = { available: false, errorCode: error?.code ?? error?.name ?? "BlobListError" }; }
  const artifactBlobResults = [];
  for (const row of databaseSnapshot.affectedArtifacts) {
    try {
      artifactBlobResults.push({ artifactKey: row.artifact_key, databaseBlobPath: row.blob_path, ...(await readBlobBytes(blob, row.blob_path, storeId)) });
    } catch (error) {
      artifactBlobResults.push({ artifactKey: row.artifact_key, databaseBlobPath: row.blob_path, exists: null, errorCode: error?.code ?? error?.name ?? "BlobGetError" });
    }
  }
  const attemptedPath = `${BLOB_NAMESPACE}${repositoryArtifact.sha256.slice(0, 2)}/${repositoryArtifact.sha256}.json`;
  let attemptedBlob;
  try { attemptedBlob = await readBlobBytes(blob, attemptedPath, storeId); }
  catch (error) { attemptedBlob = { exists: null, errorCode: error?.code ?? error?.name ?? "BlobGetError" }; }

  const metadataPaths = new Set(databaseSnapshot.allArtifactBlobPaths.map((row) => row.blob_path));
  const listedPaths = new Set((listing.blobs ?? []).map((item) => item.pathname));
  const orphanCandidates = listing.available ? (listing.blobs ?? []).filter((item) => !metadataPaths.has(item.pathname)) : [];
  const attemptStart = migrationStartedAt ? new Date(migrationStartedAt) : null;
  const postAttemptArtifacts = attemptStart && !Number.isNaN(attemptStart.valueOf())
    ? databaseSnapshot.affectedArtifacts.filter((row) => new Date(row.created_at) >= attemptStart || new Date(row.updated_at) >= attemptStart)
    : null;
  const postAttemptBlobs = attemptStart && !Number.isNaN(attemptStart.valueOf())
    ? orphanCandidates.filter((item) => item.uploadedAt && new Date(item.uploadedAt) >= attemptStart)
    : null;

  const { allArtifactBlobPaths: _internalBlobPathReferences, ...reportDatabase } = databaseSnapshot;
  return {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    environment: process.env.VERCEL_ENV ?? null,
    project: process.env.VERCEL_PROJECT_NAME ?? null,
    migrationAttemptStart: attemptStart && !Number.isNaN(attemptStart.valueOf()) ? attemptStart.toISOString() : null,
    repositoryArtifact,
    manifest: { count: sorted.length, conflictingEntryPosition: conflictIndex + 1, precedingEntryCount: preceding.length, precedingRepositoryPaths: preceding },
    database: reportDatabase,
    blob: {
      listing: { available: listing.available, complete: listing.complete ?? null, namespaceBlobCount: listing.blobs?.length ?? null, errorCode: listing.errorCode ?? null, note: listing.note ?? null },
      affectedArtifactChecksums: artifactBlobResults,
      attemptedRepositoryContentAddress: { path: attemptedPath, ...attemptedBlob, appearsReferencedInDatabase: metadataPaths.has(attemptedPath), appearsInBlobListing: listedPaths.has(attemptedPath) },
      orphanCandidates,
      orphanCandidatesAtOrAfterAttemptStart: postAttemptBlobs,
    },
    metadataRowsTouchedAtOrAfterAttemptStart: postAttemptArtifacts,
    proposedNonDestructiveRepair: [
      "Preserve existing Production metadata and Blob objects; do not overwrite or delete the conflicting key.",
      "Compare the existing database SHA/size with the actual bytes fetched from its recorded private Blob path and with the repository SHA/size.",
      "If Production's current artifact is canonical, update migration handling only after its Blob hash verifies against metadata; retain the mismatch failure for unverified content.",
      "If repository bytes are a distinct intended version, use a new versioned artifact key and update references in a separately reviewed, additive migration.",
      "Keep any unreferenced content-addressed object for manual review; do not automatically delete it.",
    ],
  };
}

export async function runConfiguredReadOnlyArtifactDiagnostic({ root = process.cwd(), migrationStartedAt = null } = {}) {
  if (process.env.VERCEL !== "1" && process.env.VERCEL !== "true") throw new Error("This diagnostic requires the deployed Vercel runtime.");
  if (process.env.VERCEL_ENV !== "production" || process.env.VERCEL_PROJECT_NAME !== "terramatch") {
    throw new Error("Run only inside the existing terramatch Production runtime.");
  }
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const storeId = process.env.BLOB_STORE_ID;
  if (!databaseUrl || !storeId) throw new Error("The Production runtime did not provide the configured database and private Blob bindings.");
  const { Pool } = await import("pg");
  const { get, list } = await import("@vercel/blob");
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const report = await runReadOnlyArtifactDiagnostic({ pool, blob: { get }, listBlobs: list, storeId, root, migrationStartedAt });
    return sanitizeDiagnosticOutput(report);
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const report = await runConfiguredReadOnlyArtifactDiagnostic({ root: process.cwd(), migrationStartedAt: process.argv.find((arg) => arg.startsWith("--attempt-start="))?.split("=").slice(1).join("=") ?? null });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    // Never echo raw error messages: providers may include request context or credentials.
    process.stderr.write(`${JSON.stringify({ status: "diagnostic_failed", errorCode: error?.code ?? error?.name ?? "UnknownError", detail: "Sensitive error text suppressed." })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
