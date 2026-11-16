import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
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
  assert.deepEqual(await store.setLatest("processed/discovery-runs/latest", "processed/discovery-runs/run-1.json"), {
    pointer_key: "processed/discovery-runs/latest", artifact_key: "processed/discovery-runs/run-1.json", revision: 1,
  });
  objects.values().next().value[0] ^= 0xff;
  await assert.rejects(store.readJson("processed/discovery-runs/run-1.json"), /integrity check failed/);
  assert.throws(() => store.normalizeKey("../secrets.json"), /invalid path segment/);
});


test("Vercel job storage deduplicates submissions and atomically claims and retries durable work", async () => {
  const jobs=new Map(), keys=new Map();
  const publicRow=(row)=>({...row});
  const pool={
    async query(sql,values=[]){
      if(sql.includes("CREATE TABLE IF NOT EXISTS"))return{rows:[]};
      if(sql.includes("UPDATE terramatch_jobs SET status = 'starting'")){const row=jobs.get(values[0]);if(!row)return{rows:[]};const queued=["queued","retrying"].includes(row.status),stale=row.status==="starting"&&Date.now()-row.updatedAtMs>60000;if(!queued&&!stale)return{rows:[]};row.status="starting";if(queued)row.attempt++;row.updated_at=new Date().toISOString();row.updatedAtMs=Date.now();return{rows:[{job_id:row.job_id,attempt:row.attempt,status:row.status,payload:row.payload}]};}
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
