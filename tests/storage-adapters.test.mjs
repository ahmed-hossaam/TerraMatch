import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { getIncidentManifestPaths, runReadOnlyArtifactDiagnostic, sanitizeDiagnosticOutput } from "../scripts/diagnose-vercel-artifact-store.mjs";
import { DIAGNOSTIC_RUNTIME_INPUTS, VERCEL_FUNCTION_ALIASES, packageArtifactDiagnosticInputs } from "../scripts/package-vercel-artifact-diagnostic.mjs";
import { LocalJsonArtifactStore } from "../scripts/storage/local-json-artifact-store.mjs";
import { createVercelArtifactStoreFromEnvironment, VercelJsonArtifactStore } from "../scripts/storage/vercel-json-artifact-store.mjs";
import { Readable } from "node:stream";

test("local artifact store reads, lists, and atomically updates JSON artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-store-"));
  try {
    const store = new LocalJsonArtifactStore(root);
    await store.writeJsonAtomic("processed/discovery-runs/latest.json", { runId: "first" });
    assert.deepEqual(await store.readJson("processed/discovery-runs/latest.json"), { runId: "first" });
    assert.deepEqual(await store.listNames("processed/discovery-runs", /^latest\.json$/), ["latest.json"]);
    await store.writeJsonAtomic("processed/discovery-runs/latest.json", { runId: "second" });
    assert.deepEqual(await store.readJson("processed/discovery-runs/latest.json"), { runId: "second" });
    assert.equal(await store.readOptionalJson("processed/discovery-runs/missing.json"), null);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("concurrent local latest-pointer writes never expose partial JSON", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-store-"));
  try {
    const store = new LocalJsonArtifactStore(root);
    await Promise.all(Array.from({ length: 16 }, (_, index) => store.writeJsonAtomic("processed/comparison-runs/latest.json", { runId: `run-${index}`, sequence: index })));
    const final = await store.readJson("processed/comparison-runs/latest.json");
    assert.match(final.runId, /^run-\d+$/);
    assert.ok(Number.isInteger(final.sequence));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("local artifact store rejects path traversal and immutable archive replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-store-"));
  try {
    const store = new LocalJsonArtifactStore(root);
    assert.throws(() => store.path("../outside.json"), /within the configured data root/);
    assert.throws(() => store.path(join(root, "absolute.json")), /relative path/);
    await store.writeJsonImmutable("processed/discovery-runs/run-1.json", { runId: "run-1" });
    assert.deepEqual(await store.readJson("processed/discovery-runs/run-1.json"), { runId: "run-1" });
    await assert.rejects(store.writeJsonImmutable("processed/discovery-runs/run-1.json", { runId: "replacement" }));
    assert.deepEqual(await store.readJson("processed/discovery-runs/run-1.json"), { runId: "run-1" });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("a failed atomic write does not replace the existing artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-store-"));
  try {
    const store = new LocalJsonArtifactStore(root);
    await store.writeJsonAtomic("artifact.json", { state: "old" });
    await mkdir(join(root, "blocked"));
    await writeFile(join(root, "blocked", "child.json"), "not a directory");
    await assert.rejects(store.writeJsonAtomic("blocked/child.json/nested.json", { state: "new" }));
    assert.deepEqual(JSON.parse(await readFile(join(root, "artifact.json"), "utf8")), { state: "old" });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
});

test("Vercel store uses private content-addressed blobs, verifies integrity, and updates pointers", async () => {
  const rows = new Map();
  const pointers = new Map();
  const objects = new Map();
  const pool = {
    async query(sql, values = []) {
      if (sql.includes("CREATE TABLE IF NOT EXISTS")) return { rows: [] };
      if (sql.includes("SELECT sha256, immutable FROM terramatch_artifacts")) {
        const row = rows.get(values[0]);
        return { rows: row ? [{ sha256: row.sha256, immutable: row.immutable }] : [] };
      }
      if (sql.includes("UPDATE terramatch_artifacts SET immutable")) {
        const row = rows.get(values[0]);
        if (row?.sha256 === values[1]) row.immutable = true;
        return { rowCount: row?.sha256 === values[1] ? 1 : 0, rows: [] };
      }
      if (sql.includes("SELECT blob_path, sha256")) {
        const row = rows.get(values[0]);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("SELECT artifact_key FROM terramatch_artifacts")) {
        const prefix = values[0].slice(0, -1);
        return { rows: [...rows.keys()].filter((key) => key.startsWith(prefix)).map((artifact_key) => ({ artifact_key })) };
      }
      if (sql.includes("INSERT INTO terramatch_latest_pointers")) {
        if (!rows.has(values[1])) return { rowCount: 0, rows: [] };
        const current = pointers.get(values[0]);
        pointers.set(values[0], { pointer_key: values[0], artifact_key: values[1], revision: (current?.revision ?? 0) + 1 });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("SELECT artifact_key, revision")) return { rows: pointers.has(values[0]) ? [pointers.get(values[0])] : [] };
      throw new Error(`Unexpected pool query: ${sql.slice(0, 80)}`);
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
          if (sql.includes("SELECT sha256, immutable")) {
            const row = rows.get(values[0]);
            return { rows: row ? [{ sha256: row.sha256, immutable: row.immutable }] : [] };
          }
          if (sql.includes("SELECT artifact_key FROM terramatch_artifacts")) {
            return { rows: rows.has(values[0]) ? [{ artifact_key: values[0] }] : [] };
          }
          if (sql.includes("INSERT INTO terramatch_artifacts")) {
            rows.set(values[0], { artifact_key: values[0], blob_path: values[1], sha256: values[2], byte_size: values[3], immutable: Boolean(values[4]) || Boolean(rows.get(values[0])?.immutable) });
            return { rows: [] };
          }
          throw new Error(`Unexpected client query: ${sql.slice(0, 80)}`);
        },
        release() {},
      };
    },
  };
  const blob = {
    async put(path, body, options) { assert.equal(options.access, "private"); assert.equal(options.allowOverwrite, false); objects.set(path, Buffer.from(body)); return { pathname: path }; },
    async get(path, options) { assert.equal(options.access, "private"); const bytes = objects.get(path); return bytes ? { statusCode: 200, stream: Readable.toWeb(Readable.from(bytes)) } : null; },
  };
  const store = new VercelJsonArtifactStore({ pool, blob, storeId: "test-store" });
  await store.writeJsonImmutable("processed/discovery-runs/run-1.json", { runId: "run-1", missing: null });
  assert.deepEqual(await store.readJson("processed/discovery-runs/run-1.json"), { runId: "run-1", missing: null });
  assert.deepEqual(await store.listNames("processed/discovery-runs", /^run-.*\.json$/), ["run-1.json"]);
  await assert.rejects(store.writeJsonImmutable("processed/discovery-runs/run-1.json", { runId: "changed" }), /Immutable artifact/);
  await store.writeBytesAtomic("processed/comparison-runs/latest.json", Buffer.from("runtime-head"));
  assert.equal(await store.writeBytesIfAbsent("processed/comparison-runs/latest.json", Buffer.from("seed-head")), false);
  assert.equal((await store.readBytes("processed/comparison-runs/latest.json")).toString("utf8"), "runtime-head");
  assert.equal(await store.writeBytesIfAbsent("processed/discovery-runs/validation-report.json", Buffer.from("seed-report")), true);
  assert.equal((await store.readBytes("processed/discovery-runs/validation-report.json")).toString("utf8"), "seed-report");
  assert.deepEqual(await store.setLatest("processed/discovery-runs/latest", "processed/discovery-runs/run-1.json"), {
    pointer_key: "processed/discovery-runs/latest", artifact_key: "processed/discovery-runs/run-1.json", revision: 1,
  });
  objects.values().next().value[0] ^= 0xff;
  await assert.rejects(store.readJson("processed/discovery-runs/run-1.json"), /integrity check failed/);
  assert.throws(() => store.normalizeKey("../secrets.json"), /invalid path segment/);
});

test("Vercel immutable conflicts are rejected under the key lock before Blob upload", async () => {
  const events = [];
  const incoming = Buffer.from("new immutable bytes");
  const rows = new Map([["evidence/immutable.csv", { sha256: "a".repeat(64), immutable: true }]]);
  const pool = {
    async query(sql) {
      if (sql.includes("CREATE TABLE IF NOT EXISTS")) return { rows: [] };
      throw new Error(`Unexpected pool query: ${sql.slice(0, 80)}`);
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN") { events.push("begin"); return { rows: [] }; }
          if (sql.includes("pg_advisory_xact_lock")) { events.push("advisory-lock"); return { rows: [] }; }
          if (sql.includes("SELECT sha256, immutable")) {
            events.push("select-for-update");
            const row = rows.get(values[0]);
            return { rows: row ? [{ ...row }] : [] };
          }
          if (sql === "ROLLBACK") { events.push("rollback"); return { rows: [] }; }
          if (sql === "COMMIT") { events.push("commit"); return { rows: [] }; }
          throw new Error(`Unexpected client query: ${sql.slice(0, 80)}`);
        },
        release() {},
      };
    },
  };
  let uploads = 0;
  const blob = { async put() { uploads += 1; events.push("blob-put"); } };
  const store = new VercelJsonArtifactStore({ pool, blob, storeId: "test-store" });

  await assert.rejects(store.writeBytesImmutable("evidence/immutable.csv", incoming), /Immutable artifact already exists/);
  assert.equal(uploads, 0);
  assert.deepEqual(events, ["begin", "advisory-lock", "select-for-update", "rollback"]);
});

test("concurrent immutable writes serialize by key and upload only the winning bytes", async () => {
  const events = [];
  const rows = new Map();
  const objects = new Map();
  let lockHeld = false;
  const lockQueue = [];
  const acquireKeyLock = async () => {
    if (!lockHeld) { lockHeld = true; return; }
    await new Promise((resolve) => lockQueue.push(resolve));
  };
  const releaseKeyLock = () => {
    const next = lockQueue.shift();
    if (next) next();
    else lockHeld = false;
  };
  const pool = {
    async query(sql) {
      if (sql.includes("CREATE TABLE IF NOT EXISTS")) return { rows: [] };
      throw new Error(`Unexpected pool query: ${sql.slice(0, 80)}`);
    },
    async connect() {
      let holdsLock = false;
      return {
        async query(sql, values = []) {
          if (sql === "BEGIN") { events.push("begin"); return { rows: [] }; }
          if (sql.includes("pg_advisory_xact_lock")) {
            events.push("lock-request");
            await acquireKeyLock();
            holdsLock = true;
            events.push("lock-acquired");
            return { rows: [] };
          }
          if (sql.includes("SELECT sha256, immutable")) {
            events.push("select-for-update");
            const row = rows.get(values[0]);
            return { rows: row ? [{ ...row }] : [] };
          }
          if (sql.includes("INSERT INTO terramatch_artifacts")) {
            events.push("metadata-insert");
            rows.set(values[0], { sha256: values[2], immutable: Boolean(values[4]) });
            objects.set(values[1], Buffer.from(values[2]));
            return { rows: [] };
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") {
            events.push(sql.toLowerCase());
            if (holdsLock) { holdsLock = false; releaseKeyLock(); }
            return { rows: [] };
          }
          throw new Error(`Unexpected client query: ${sql.slice(0, 80)}`);
        },
        release() { if (holdsLock) { holdsLock = false; releaseKeyLock(); } },
      };
    },
  };
  const uploaded = [];
  const blob = {
    async put(path, bytes) {
      events.push("blob-put");
      uploaded.push({ path, bytes: Buffer.from(bytes) });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { pathname: path };
    },
  };
  const store = new VercelJsonArtifactStore({ pool, blob, storeId: "test-store" });
  const candidates = [Buffer.from("first concurrent version"), Buffer.from("second concurrent version")];
  const results = await Promise.allSettled(candidates.map((bytes) => store.writeBytesImmutable("evidence/concurrent.csv", bytes)));

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && /Immutable artifact already exists/.test(result.reason.message)).length, 1);
  assert.equal(uploaded.length, 1);
  const storedHash = rows.get("evidence/concurrent.csv").sha256;
  assert.equal(storedHash, createHash("sha256").update(uploaded[0].bytes).digest("hex"));
  assert.ok(events.indexOf("lock-acquired") < events.indexOf("select-for-update"));
  assert.ok(events.indexOf("select-for-update") < events.indexOf("blob-put"));
  assert.equal(objects.size, 1);
});

test("Production artifact diagnostic selects exactly the 46 manifest entries before the incident key", async () => {
  const manifest = JSON.parse(await readFile(new URL("../scripts/migration/vercel-seed-manifest.json", import.meta.url), "utf8"));
  const incident = getIncidentManifestPaths(manifest);
  assert.equal(incident.conflictIndex, 46);
  assert.equal(incident.preceding.length, 46);
  assert.equal(incident.sorted[46], "data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv");
  assert.equal(new Set(incident.preceding).size, 46);
});

test("Vercel diagnostic packaging includes only the three required runtime provenance inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-diagnostic-package-"));
  try {
    const output = join(root, ".vercel", "output", "functions");
    const server = join(output, "__server.func");
    const api = join(output, "api", "[...].func");
    const webhook = join(output, ".well-known", "workflow", "v1", "webhook", "[token].func");
    await mkdir(server, { recursive: true });
    await writeFile(join(server, "index.mjs"), "export default true;\n");
    await mkdir(dirname(api), { recursive: true });
    await mkdir(dirname(webhook), { recursive: true });
    await symlink(server, api, "junction");
    await symlink(server, webhook, "junction");
    for (const [index, relativePath] of DIAGNOSTIC_RUNTIME_INPUTS.entries()) {
      const source = join(root, relativePath);
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, `verified-${index}`);
    }

    const packaged = await packageArtifactDiagnosticInputs({ projectRoot: root, outputRoot: output });
    assert.equal(packaged.length, 3);
    for (const [index, path] of packaged.entries()) assert.equal(await readFile(path, "utf8"), `verified-${index}`);
    assert.deepEqual(packaged.map((path) => path.slice(api.length + 1).replaceAll("\\", "/")), DIAGNOSTIC_RUNTIME_INPUTS);
    for (const alias of VERCEL_FUNCTION_ALIASES) {
      const functionPath = join(output, alias);
      assert.equal((await lstat(functionPath)).isSymbolicLink(), false);
      assert.equal(await readFile(join(functionPath, "index.mjs"), "utf8"), "export default true;\n");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Production artifact diagnostic runs in a read-only transaction and uses only Blob reads/listing", async () => {
  const tx = [];
  const pool = { async connect() { return {
    async query(sql) {
      tx.push(sql);
      if (sql === "BEGIN READ ONLY") return { rows: [] };
      if (sql.includes("transaction_read_only")) return { rows: [{ read_only: "on", database_name: "test-db" }] };
      if (sql.includes("information_schema.columns")) {
        const rows = Object.entries({
          terramatch_artifacts: ["artifact_key", "blob_path", "sha256", "byte_size", "immutable", "created_at", "updated_at"],
          terramatch_latest_pointers: ["pointer_key", "artifact_key", "revision", "updated_at"],
          terramatch_jobs: ["job_id", "status", "artifact_key", "payload", "created_at", "updated_at"],
        }).flatMap(([table_name, columns]) => columns.map((column_name) => ({ table_schema: "public", table_name, column_name, data_type: "text", is_nullable: "YES" })));
        return { rows };
      }
      if (sql.includes("count(*)")) return { rows: [{ artifact_count: "0", total_bytes: "0" }] };
      if (sql.includes("FROM terramatch_artifacts WHERE artifact_key")) return { rows: [] };
      if (sql.includes("SELECT artifact_key, blob_path FROM terramatch_artifacts")) return { rows: [] };
      if (sql.includes("FROM terramatch_latest_pointers")) return { rows: [] };
      if (sql.includes("FROM terramatch_jobs")) return { rows: [] };
      if (sql === "ROLLBACK") return { rows: [] };
      throw new Error(`Unexpected diagnostic SQL: ${sql.slice(0, 80)}`);
    },
    release() { tx.push("RELEASE"); },
  }; } };
  const blobCalls = [];
  const blob = { async get(path, options) { blobCalls.push(["get", path, options]); return null; } };
  const listBlobs = async (options) => { blobCalls.push(["list", options]); return { blobs: [], hasMore: false }; };
  const report = await runReadOnlyArtifactDiagnostic({ pool, blob, listBlobs, storeId: "test-store", root: process.cwd() });

  assert.equal(report.mode, "read-only");
  assert.equal(report.database.transactionReadOnly, true);
  assert.equal(report.manifest.precedingEntryCount, 46);
  assert.equal(report.database.affectedArtifacts.length, 0);
  assert.equal(report.blob.listing.available, true);
  assert.equal(tx[0], "BEGIN READ ONLY");
  assert.equal(tx.at(-2), "ROLLBACK");
  assert.ok(tx.includes("RELEASE"));
  assert.ok(tx.every((sql) => sql === "BEGIN READ ONLY" || sql === "ROLLBACK" || sql === "RELEASE" || /^(SELECT|\s*SELECT)/i.test(sql)));
  assert.ok(blobCalls.every(([method]) => method === "get" || method === "list"));
});

test("Production diagnostic output sanitization drops credential fields and redacts credential-shaped strings", () => {
  const sanitized = sanitizeDiagnosticOutput({
    status: "complete",
    artifact: { key: "evidence/a.csv", blobReadWriteToken: "should-not-appear", connectionString: "postgres://hidden" },
    detail: "provider returned Bearer abc.def and postgres://user:password@host/db?token=secret-value",
    values: ["safe", "eyJabcdefghijk.abcdefghijk.abcdefghijk"],
  });
  const serialized = JSON.stringify(sanitized);
  assert.deepEqual(sanitized.artifact, { key: "evidence/a.csv" });
  assert.doesNotMatch(serialized, /should-not-appear|postgres:\/\/user:password|Bearer abc\.def|eyJabcdefghijk|token=secret-value/);
  assert.match(serialized, /\[redacted\]/);
});


test("Vercel job storage deduplicates submissions and atomically claims and retries durable work", async () => {
  const jobs=new Map(), keys=new Map();
  const publicRow=(row)=>({...row});
  const pool={
    async query(sql,values=[]){
      if(sql.includes("CREATE TABLE IF NOT EXISTS"))return{rows:[]};
      if(sql.includes("UPDATE terramatch_jobs SET status = 'starting'")){const row=jobs.get(values[0]);if(!row)return{rows:[]};const queued=["queued","retrying"].includes(row.status),stale=row.status==="starting"&&Date.now()-row.updatedAtMs>60000;if(!queued&&!stale)return{rows:[]};row.status="starting";if(queued)row.attempt++;row.updated_at=new Date().toISOString();row.updatedAtMs=Date.now();return{rows:[{job_id:row.job_id,attempt:row.attempt,status:row.status,payload:row.payload}]};}
      if(sql.includes("UPDATE terramatch_jobs SET") && !sql.includes("status = 'starting'") && !sql.includes("status = 'retrying'")){const row=jobs.get(values[0]);if(!row)return{rows:[]};if(values[1])row.status=values[1];if(values[2])row.payload=JSON.parse(values[2]);if(values[3])row.workflow_run_id=values[3];if(values[4])row.artifact_key=values[4];if(values[5])row.attempt++;return{rows:[publicRow(row)]};}
      if(sql.includes("UPDATE terramatch_jobs SET status = 'retrying'")){const row=jobs.get(values[0]);if(!row||row.status!=="failed")return{rows:[]};row.status="retrying";row.workflow_run_id=null;row.updated_at=new Date().toISOString();return{rows:[{job_id:row.job_id,attempt:row.attempt,payload:row.payload}]};}
      throw new Error(`Unexpected job query: ${sql.slice(0,80)}`);
    },
    async connect(){return{async query(sql,values=[]){
      if(["BEGIN","COMMIT","ROLLBACK"].includes(sql))return{rows:[]};
      if(sql.includes("INSERT INTO terramatch_jobs")){const [jobId,key,payload]=values;const existing=key?jobs.get(keys.get(key)):null;if(existing)return{rows:[]};const row={job_id:jobId,idempotency_key:key,workflow_run_id:null,status:"queued",attempt:0,artifact_key:null,payload:JSON.parse(payload),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),updatedAtMs:Date.now()};jobs.set(jobId,row);if(key)keys.set(key,jobId);return{rows:[publicRow(row)]};}
      if(sql.includes("SELECT job_id, idempotency_key")){const row=jobs.get(keys.get(values[0]));return{rows:row?[publicRow(row)]:[]};}
      throw new Error(`Unexpected job client query: ${sql.slice(0,80)}`);
    },release(){}};}
  };
  const blob={async put(){throw new Error("unused");},async get(){return null;}};
  const store=new VercelJsonArtifactStore({pool,blob,storeId:"test-store"});
  const sameKey=await Promise.all([1,2].map((n)=>store.createJob({jobId:`job-${n}`,status:"queued",stages:[]},"submission-1")));
  assert.equal(sameKey[0].job_id,sameKey[1].job_id);assert.equal(jobs.size,1);
  const claims=await Promise.all([store.claimWorkflowStart(sameKey[0].job_id),store.claimWorkflowStart(sameKey[0].job_id)]);
  assert.equal(claims.filter(Boolean).length,1);assert.equal(jobs.get(sameKey[0].job_id).attempt,1);
  const startingPayload={status:"starting",attempt:1};
  const starting=await store.updateJob(sameKey[0].job_id,{status:"starting",payload:startingPayload});
  assert.equal(starting.status,"starting");assert.deepEqual(starting.payload,startingPayload);
  jobs.get(sameKey[0].job_id).updatedAtMs=Date.now()-120000;
  const recovery=await store.claimWorkflowStart(sameKey[0].job_id);assert.equal(recovery.attempt,1);
  jobs.get(sameKey[0].job_id).status="failed";
  const retry=await store.queueJobRetry(sameKey[0].job_id);assert.equal(retry.job_id,sameKey[0].job_id);assert.equal(jobs.get(retry.job_id).status,"retrying");
  const retryClaim=await store.claimWorkflowStart(retry.job_id);assert.equal(retryClaim.attempt,2);
});

test("Vercel preview storage fails closed until Neon branch isolation is attested", async () => {
  const previousEnvironment = process.env.VERCEL_ENV;
  const previousIsolation = process.env.TERRAMATCH_PREVIEW_DB_ISOLATED;
  process.env.VERCEL_ENV = "preview";
  delete process.env.TERRAMATCH_PREVIEW_DB_ISOLATED;
  try {
    assert.throws(() => createVercelArtifactStoreFromEnvironment(), (error) => error.status === 503 && /isolated non-production branch/.test(error.message));
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
    if (previousIsolation === undefined) delete process.env.TERRAMATCH_PREVIEW_DB_ISOLATED;
    else process.env.TERRAMATCH_PREVIEW_DB_ISOLATED = previousIsolation;
  }
});
