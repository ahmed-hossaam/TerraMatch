import { createHash } from "node:crypto";
import { Readable } from "node:stream";

/** Durable JSON artifact store backed by Neon metadata and a private Vercel Blob store.
 * Blob objects are content-addressed and immutable. Postgres rows are the mutable
 * names/pointers, so replacing a latest pointer is atomic across function instances.
 */
export class VercelJsonArtifactStore {
  constructor({ pool, blob, storeId, namespace = "terramatch/v1" }) {
    if (!pool || !blob) throw new Error("Neon pool and Vercel Blob client are required.");
    if (!storeId) throw new Error("BLOB_STORE_ID is required for durable artifact storage.");
    this.pool = pool;
    this.blob = blob;
    this.storeId = storeId;
    this.namespace = namespace.replace(/^\/+|\/+$/g, "");
    this.schemaPromise = null;
  }

  async ensureSchema() {
    if (!this.schemaPromise) this.schemaPromise = this.pool.query(`
      CREATE TABLE IF NOT EXISTS terramatch_artifacts (
        artifact_key text PRIMARY KEY,
        blob_path text NOT NULL,
        sha256 char(64) NOT NULL,
        byte_size bigint NOT NULL CHECK (byte_size >= 0),
        immutable boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS terramatch_artifacts_prefix_idx
        ON terramatch_artifacts (artifact_key text_pattern_ops);
      CREATE TABLE IF NOT EXISTS terramatch_jobs (
        job_id text PRIMARY KEY,
        idempotency_key text UNIQUE,
        workflow_run_id text,
        status text NOT NULL,
        attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
        artifact_key text,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS terramatch_jobs_status_idx
        ON terramatch_jobs (status, updated_at);
      CREATE TABLE IF NOT EXISTS terramatch_latest_pointers (
        pointer_key text PRIMARY KEY,
        artifact_key text NOT NULL,
        revision bigint NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `).then(() => true).catch((error) => { this.schemaPromise = null; throw error; });
    return this.schemaPromise;
  }

  normalizeKey(key) {
    if (typeof key !== "string" || !key || key.startsWith("/") || key.includes("\\")) {
      throw new Error("Artifact key must be a non-empty relative POSIX path.");
    }
    const parts = key.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) throw new Error("Artifact key contains an invalid path segment.");
    return parts.join("/");
  }

  async readBytes(key) {
    await this.ensureSchema();
    const normalized = this.normalizeKey(key);
    const { rows } = await this.pool.query("SELECT blob_path, sha256 FROM terramatch_artifacts WHERE artifact_key = $1", [normalized]);
    if (!rows[0]) {
      const error = new Error(`Artifact not found: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    const result = await this.blob.get(rows[0].blob_path, { access: "private", storeId: this.storeId });
    if (!result || result.statusCode !== 200 || !result.stream) {
      const error = new Error(`Private artifact is unavailable: ${normalized}`);
      error.code = "EARTIFACT_UNAVAILABLE";
      throw error;
    }
    const chunks = [];
    for await (const chunk of Readable.fromWeb(result.stream)) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (createHash("sha256").update(bytes).digest("hex") !== rows[0].sha256) {
      const error = new Error(`Artifact integrity check failed: ${normalized}`);
      error.code = "EARTIFACT_CORRUPT";
      throw error;
    }
    return bytes;
  }

  async readJson(key) { return JSON.parse((await this.readBytes(key)).toString("utf8")); }

  async readOptionalJson(key) {
    try { return await this.readJson(key); }
    catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  }

  async listNames(prefix, pattern = /.*/) {
    await this.ensureSchema();
    const normalized = this.normalizeKey(prefix).replace(/\/$/, "");
    const { rows } = await this.pool.query(
      "SELECT artifact_key FROM terramatch_artifacts WHERE artifact_key LIKE $1 ORDER BY artifact_key DESC",
      [`${normalized}/%`],
    );
    return rows.map(({ artifact_key }) => artifact_key.slice(normalized.length + 1))
      .filter((name) => !name.includes("/") && pattern.test(name));
  }

  async writeJsonAtomic(key, value) { return this.#write(key, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"), false); }
  async writeJsonImmutable(key, value) { return this.#write(key, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"), true); }
  async writeBytesAtomic(key, bytes) { return this.#write(key, Buffer.from(bytes), false); }
  async writeBytesImmutable(key, bytes) { return this.#write(key, Buffer.from(bytes), true); }

  async writeBytesIfAbsent(key, bytes) {
    await this.ensureSchema();
    const normalized = this.normalizeKey(key);
    const body = Buffer.from(bytes);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const blobPath = `${this.namespace}/objects/${sha256.slice(0, 2)}/${sha256}.json`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [normalized]);
      const existing = await client.query("SELECT artifact_key FROM terramatch_artifacts WHERE artifact_key = $1 FOR UPDATE", [normalized]);
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return false;
      }
      try {
        await this.blob.put(blobPath, body, {
          access: "private", addRandomSuffix: false, allowOverwrite: false,
          contentType: normalized.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream",
          storeId: this.storeId,
        });
      } catch (error) {
        if (!/already exists|already been taken|conflict/i.test(String(error?.message))) throw error;
      }
      await client.query(`
        INSERT INTO terramatch_artifacts (artifact_key, blob_path, sha256, byte_size, immutable)
        VALUES ($1, $2, $3, $4, false)
        ON CONFLICT (artifact_key) DO NOTHING
      `, [normalized, blobPath, sha256, body.byteLength]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async #write(key, bytes, immutable) {
    await this.ensureSchema();
    const normalized = this.normalizeKey(key);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const blobPath = `${this.namespace}/objects/${sha256.slice(0, 2)}/${sha256}.json`;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the logical key before examining metadata or uploading. SELECT FOR
      // UPDATE cannot lock a row that does not exist yet, so the advisory lock
      // also serializes concurrent first writes for this key.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [normalized]);
      const existing = await client.query("SELECT sha256, immutable FROM terramatch_artifacts WHERE artifact_key = $1 FOR UPDATE", [normalized]);
      const current = existing.rows[0];

      // An immutable request must never change an existing key, even when the
      // stored row itself was previously marked mutable. Detect this before
      // touching Blob so rejected writes cannot leave orphaned content objects.
      if (current?.sha256 !== sha256 && current && (current.immutable || immutable)) {
        throw new Error(`Immutable artifact already exists with different content: ${normalized}`);
      }

      // Make repeatable data seeding cheap: matching bytes need no Blob upload.
      if (current?.sha256 === sha256) {
        if (!current.immutable && immutable) {
          await client.query("UPDATE terramatch_artifacts SET immutable = true, updated_at = now() WHERE artifact_key = $1 AND sha256 = $2", [normalized, sha256]);
        }
        await client.query("COMMIT");
        return normalized;
      }

      // Upload while holding the per-key transaction lock. Blob paths are
      // content-addressed and never overwritten; SQL metadata is committed only
      // after the upload succeeds.
      try {
        await this.blob.put(blobPath, bytes, {
          access: "private", addRandomSuffix: false, allowOverwrite: false,
          contentType: normalized.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream", storeId: this.storeId,
        });
      } catch (error) {
        // A duplicate content-addressed path is safe only after the same hash is
        // verified from its actual private Blob bytes; otherwise preserve the
        // provider failure and never register unverified object contents.
        if (!/already exists|already been taken|conflict/i.test(String(error?.message))) throw error;
        const existingBlob = await this.blob.get(blobPath, { access: "private", storeId: this.storeId, useCache: false });
        if (!existingBlob || existingBlob.statusCode !== 200 || !existingBlob.stream) {
          throw new Error(`Existing content-addressed Blob could not be verified: ${normalized}`);
        }
        const chunks = [];
        for await (const chunk of Readable.fromWeb(existingBlob.stream)) chunks.push(Buffer.from(chunk));
        const existingBytes = Buffer.concat(chunks);
        if (existingBytes.byteLength !== bytes.byteLength || createHash("sha256").update(existingBytes).digest("hex") !== sha256) {
          throw new Error(`Existing content-addressed Blob failed integrity verification: ${normalized}`);
        }
      }

      await client.query(`
        INSERT INTO terramatch_artifacts (artifact_key, blob_path, sha256, byte_size, immutable)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (artifact_key) DO UPDATE SET
          blob_path = EXCLUDED.blob_path,
          sha256 = EXCLUDED.sha256,
          byte_size = EXCLUDED.byte_size,
          immutable = terramatch_artifacts.immutable OR EXCLUDED.immutable,
          updated_at = now()
      `, [normalized, blobPath, sha256, bytes.byteLength, immutable]);
      await client.query("COMMIT");
      return normalized;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async setLatest(pointerKey, artifactKey) {
    await this.ensureSchema();
    const pointer = this.normalizeKey(pointerKey);
    const artifact = this.normalizeKey(artifactKey);
    const { rowCount } = await this.pool.query(`
      INSERT INTO terramatch_latest_pointers(pointer_key, artifact_key)
      SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM terramatch_artifacts WHERE artifact_key = $2)
      ON CONFLICT(pointer_key) DO UPDATE SET artifact_key = EXCLUDED.artifact_key,
        revision = terramatch_latest_pointers.revision + 1, updated_at = now()
    `, [pointer, artifact]);
    if (!rowCount) throw new Error(`Latest pointer target does not exist: ${artifact}`);
    return this.getLatest(pointer);
  }

  async getLatest(pointerKey) {
    await this.ensureSchema();
    const { rows } = await this.pool.query("SELECT artifact_key, revision, updated_at FROM terramatch_latest_pointers WHERE pointer_key = $1", [this.normalizeKey(pointerKey)]);
    return rows[0] ?? null;
  }

  async createJob(job, idempotencyKey = null) {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(`
        INSERT INTO terramatch_jobs(job_id, idempotency_key, status, attempt, payload)
        VALUES ($1, $2, 'queued', 0, $3::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING job_id, idempotency_key, workflow_run_id, status, attempt, artifact_key, payload, created_at, updated_at
      `, [job.jobId, idempotencyKey, JSON.stringify(job)]);
      const result = inserted.rows[0] ?? (await client.query(
        "SELECT job_id, idempotency_key, workflow_run_id, status, attempt, artifact_key, payload, created_at, updated_at FROM terramatch_jobs WHERE idempotency_key = $1 FOR UPDATE",
        [idempotencyKey],
      )).rows[0];
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async importLegacyJob(job) {
    await this.ensureSchema();
    if (!job || typeof job.jobId !== "string") throw new Error("Legacy job must include its original jobId.");
    const status = ["queued", "running", "completed", "failed", "retrying"].includes(job.status) ? job.status : "failed";
    const { rows } = await this.pool.query(`
      INSERT INTO terramatch_jobs(job_id, status, attempt, payload, created_at, updated_at)
      VALUES ($1, $2, 0, $3::jsonb, COALESCE($4::timestamptz, now()), COALESCE($5::timestamptz, now()))
      ON CONFLICT(job_id) DO NOTHING
      RETURNING job_id
    `, [job.jobId, status, JSON.stringify(job), job.createdAt ?? null, job.updatedAt ?? null]);
    return rows.length === 1;
  }

  async getJob(jobId) {
    await this.ensureSchema();
    const { rows } = await this.pool.query(
      "SELECT job_id, idempotency_key, workflow_run_id, status, attempt, artifact_key, payload, created_at, updated_at FROM terramatch_jobs WHERE job_id = $1",
      [jobId],
    );
    return rows[0] ?? null;
  }

  async listJobs(limit = 100) {
    await this.ensureSchema();
    const safeLimit = Math.max(1, Math.min(250, Number.isInteger(limit) ? limit : 100));
    const { rows } = await this.pool.query(
      "SELECT job_id, idempotency_key, workflow_run_id, status, attempt, artifact_key, payload, created_at, updated_at FROM terramatch_jobs ORDER BY created_at DESC LIMIT $1",
      [safeLimit],
    );
    return rows;
  }

  async updateJob(jobId, { status, payload, workflowRunId, artifactKey, incrementAttempt = false, expectedStatuses } = {}) {
    await this.ensureSchema();
    const allowed = ["queued", "starting", "running", "completed", "failed", "retrying"];
    if (status && !allowed.includes(status)) throw new Error(`Invalid job status: ${status}`);
    const { rows } = await this.pool.query(`
      UPDATE terramatch_jobs SET
        status = COALESCE($2, status),
        payload = COALESCE($3::jsonb, payload),
        workflow_run_id = COALESCE($4, workflow_run_id),
        artifact_key = COALESCE($5, artifact_key),
        attempt = attempt + CASE WHEN $6 THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE job_id = $1 AND ($7::text[] IS NULL OR status = ANY($7::text[]))
      RETURNING job_id, idempotency_key, workflow_run_id, status, attempt, artifact_key, payload, created_at, updated_at
    `, [jobId, status ?? null, payload == null ? null : JSON.stringify(payload), workflowRunId ?? null, artifactKey ?? null, incrementAttempt, expectedStatuses ?? null]);
    return rows[0] ?? null;
  }

  async claimWorkflowStart(jobId) {
    await this.ensureSchema();
    const { rows } = await this.pool.query(`
      UPDATE terramatch_jobs SET status = 'starting',
        attempt = attempt + CASE WHEN status IN ('queued', 'retrying') THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE job_id = $1 AND (
        (status IN ('queued', 'retrying') AND workflow_run_id IS NULL)
        OR (status = 'starting' AND updated_at < now() - interval '60 seconds')
      )
      RETURNING job_id, attempt, status, payload
    `, [jobId]);
    return rows[0] ?? null;
  }

  async queueJobRetry(jobId) {
    await this.ensureSchema();
    const { rows } = await this.pool.query(`
      UPDATE terramatch_jobs SET status = 'retrying', workflow_run_id = NULL, updated_at = now()
      WHERE job_id = $1 AND status = 'failed'
      RETURNING job_id, attempt, payload
    `, [jobId]);
    return rows[0] ?? null;
  }

  async publishValidatedJob({ jobId, discoveryRunId, comparisonRunId, jobPayload }) {
    await this.ensureSchema();
    const pairs = [
      ["processed/discovery-runs/latest.json", `processed/discovery-runs/${discoveryRunId}.json`, "processed/discovery-runs/latest"],
      ["processed/comparison-runs/latest.json", `processed/comparison-runs/${comparisonRunId}.json`, "processed/comparison-runs/latest"],
      ["processed/discovery-runs/validation-report.json", `processed/discovery-runs/validation-reports/${discoveryRunId}.json`, "processed/discovery-runs/validation-report"],
      ["processed/comparison-runs/validation-report.json", `processed/comparison-runs/validation-reports/${comparisonRunId}.json`, "processed/comparison-runs/validation-report"],
    ];
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('terramatch:latest-run-set', 0))");
      for (const [targetKey, sourceKey, pointerKey] of pairs) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [targetKey]);
        const { rows } = await client.query(
          "SELECT blob_path, sha256, byte_size FROM terramatch_artifacts WHERE artifact_key = $1",
          [sourceKey],
        );
        if (!rows[0]) throw new Error(`Validated run artifact is missing before publishing: ${sourceKey}`);
        const source = rows[0];
        await client.query(`
          INSERT INTO terramatch_artifacts(artifact_key, blob_path, sha256, byte_size, immutable)
          VALUES ($1, $2, $3, $4, false)
          ON CONFLICT(artifact_key) DO UPDATE SET blob_path=EXCLUDED.blob_path,
            sha256=EXCLUDED.sha256, byte_size=EXCLUDED.byte_size, updated_at=now()
        `, [targetKey, source.blob_path, source.sha256, source.byte_size]);
        await client.query(`
          INSERT INTO terramatch_latest_pointers(pointer_key, artifact_key)
          VALUES ($1, $2)
          ON CONFLICT(pointer_key) DO UPDATE SET artifact_key=EXCLUDED.artifact_key,
            revision=terramatch_latest_pointers.revision+1, updated_at=now()
        `, [pointerKey, sourceKey]);
      }
      const { rowCount } = await client.query(`
        UPDATE terramatch_jobs SET status='completed', payload=$2::jsonb, updated_at=now()
        WHERE job_id=$1 AND status IN ('running','starting')
      `, [jobId, JSON.stringify(jobPayload)]);
      if (!rowCount) throw new Error(`Job ${jobId} was not in a publishable state.`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }
}

export function createVercelArtifactStoreFromEnvironment() {
  if (process.env.VERCEL_ENV === "preview" && process.env.TERRAMATCH_PREVIEW_DB_ISOLATED !== "true") {
    throw Object.assign(new Error("Preview durable storage is disabled until its Neon endpoint is verified as an isolated non-production branch."), { status: 503 });
  }
  const databaseUrl = process.env.DATABASE_URL;
  const storeId = process.env.BLOB_STORE_ID;
  if (!databaseUrl || !storeId) throw new Error("Vercel durable storage requires DATABASE_URL and BLOB_STORE_ID.");
  return Promise.all([import("pg"), import("@vercel/blob"), import("@vercel/functions")]).then(([pg, blob, vercelFunctions]) => {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
    vercelFunctions.attachDatabasePool(pool);
    return new VercelJsonArtifactStore({ pool, blob, storeId });
  });
}
