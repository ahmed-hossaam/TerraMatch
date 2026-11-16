import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { preparePersistentData } from "./prepare-persistent-data.mjs";
import { LocalJsonArtifactStore } from "./storage/local-json-artifact-store.mjs";
import { createVercelArtifactStoreFromEnvironment } from "./storage/vercel-json-artifact-store.mjs";

const root = resolve(process.env.TERRAMATCH_DATA_DIR ?? process.cwd());
const onVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
if (!onVercel) await preparePersistentData({ projectRoot: root });
const localArtifactStore = new LocalJsonArtifactStore(join(root, "data"));
let productionStorePromise;
const productionStore = () => productionStorePromise ??= createVercelArtifactStoreFromEnvironment();
const artifactStore = onVercel ? new Proxy({}, { get: (_target, method) => (...args) => productionStore().then((store) => store[method](...args)) }) : localArtifactStore;
const runtime = join(root, "data", "app-runtime");
const jobsDir = join(runtime, "jobs");
const outputDir = join(runtime, "discovery-runs");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const allowedOrigins = new Set((process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean));
let activeJob = false;
const artifactKey = (path) => path.replaceAll("\\", "/").replace(/^data\//, "");
const json = async (path) => artifactStore.readJson(artifactKey(path));
const optional = async (path) => artifactStore.readOptionalJson(artifactKey(path));
const atomic = async (path, value) => artifactStore.writeJsonAtomic(artifactKey(path), value);
const send = (res, status, value) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); };
function applyApiCors(req, res, pathname) {
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return false;
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method !== "OPTIONS") return false;
  if (!origin || !allowedOrigins.has(origin)) return send(res, 403, { error: "Origin is not allowed." }), true;
  res.writeHead(204);
  res.end();
  return true;
}
// Atlas source fields are preserved verbatim on disk. These curated display labels
// keep the public application English without rewriting research/source artifacts.
const englishCountries = new Map([["مصر","Egypt"],["تشيلي","Chile"],["الولايات المتحدة","United States"],["إسرائيل","Israel"],["عُمان","Oman"],["أستراليا","Australia"],["الصين","China"],["أنتاركتيكا","Antarctica"],["إسبانيا","Spain"],["الهند","India"],["تركيا","Türkiye"],["كندا","Canada"],["إيطاليا","Italy"],["النرويج","Norway"],["آيسلندا","Iceland"]]);
function englishDisplayValue(value) {
  if (typeof value === "string") return /[\u0600-\u06ff]/u.test(value) ? null : value;
  if (Array.isArray(value)) return value.map(englishDisplayValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, englishDisplayValue(child)]));
  return value;
}
function displayReference(record) {
  const display = englishDisplayValue(record);
  const country = record.country == null ? null : englishCountries.get(record.country) ?? record.country;
  return { ...display, country, atlas: display.atlas ? { ...display.atlas, nameAr: "" } : display.atlas };
}
function displayCuration(curation) {
  if (!curation) return null;
  const { originalSourceName, ...display } = curation;
  return display;
}
function displayComparison(record) {
  const display = englishDisplayValue(record);
  const sites = record?.referenceDataset?.sites;
  if (!display?.referenceDataset || !Array.isArray(sites)) return display;
  return { ...display, referenceDataset: { ...display.referenceDataset, sites: sites.map((site, index) => ({ ...display.referenceDataset.sites[index], country: site.country == null ? null : englishCountries.get(site.country) ?? null })) } };
}
function sendComparisonRun(res, record, url) {
  const comparison = displayComparison(record);
  const hasPage = url.searchParams.has("offset") || url.searchParams.has("limit");
  if (!hasPage && Buffer.byteLength(JSON.stringify(comparison)) <= 4_000_000) return send(res, 200, comparison);
  const parsedOffset = Number(url.searchParams.get("offset") ?? 0);
  const parsedLimit = Number(url.searchParams.get("limit") ?? 12);
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(24, parsedLimit)) : 12;
  const allPairs = comparison.comparisons ?? [];
  return send(res, 200, {
    ...comparison,
    comparisons: allPairs.slice(offset, offset + limit),
    pagination: { offset, limit, totalRecords: allPairs.length, nextOffset: offset + limit < allPairs.length ? offset + limit : null },
  });
}
const idPattern = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,120}$/;
const runPattern = /^[a-f0-9-]{16,64}$/i;
async function readBody(req) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 8192) throw Object.assign(new Error("Request body exceeds 8 KB."), { status: 413 }); }
  try { return body ? JSON.parse(body) : {}; } catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }); }
}
async function files(dir, pattern) {
  return artifactStore.listNames(artifactKey(dir), pattern);
}
async function currentArtifacts() {
  const [references, fixtures, profile, discovery, comparison, missionReport, discoveryValidation, comparisonValidation, curation, evidence] = await Promise.all([
    json("data/processed/reference-sites.json"), json("data/processed/candidate-points.json"), json("data/mission-profiles/mars-surface-v1.json"),
    optional("data/processed/discovery-runs/latest.json"), optional("data/processed/comparison-runs/latest.json"), optional("data/processed/mission-profiles/validation-report.json"),
    optional("data/processed/discovery-runs/validation-report.json"), optional("data/processed/comparison-runs/validation-report.json"), optional("data/curation/reference-curation-v1.json"), optional("data/evidence/evidence-registry-v1.json"),
  ]);
  return { references: Array.isArray(references) ? references : references.records ?? [], fixtures: Array.isArray(fixtures) ? fixtures : fixtures.records ?? [], profile, discovery, comparison, missionReport, discoveryValidation, comparisonValidation, curation: curation?.records ?? [], evidence: evidence?.records ?? [] };
}
function evidenceSummaryFor(siteId, records) { const rows=records.filter((record)=>record.siteId===siteId);const countBy=(key)=>Object.fromEntries([...new Set(rows.map((row)=>row[key]))].map((value)=>[value,rows.filter((row)=>row[key]===value).length]));return{factorCount:rows.length,stateCounts:countBy("state"),basisCounts:countBy("basis"),pointComparisonEligible:rows.length>0&&rows.every((row)=>row.pointComparisonEligible===true)}; }
function validationState(report, run) {
  if (!report || !run) return { status: "missing", runId: report?.runId ?? null, errors: report?.errors?.length ?? null };
  if (report.runId !== run.runId) return { status: "stale", runId: report.runId, errors: report.errors?.length ?? null };
  return { status: report.status === "valid" ? "valid" : "invalid", runId: report.runId, errors: report.errors?.length ?? 0 };
}
function candidateCellBounds(candidate, studyArea) {
  const spacing=candidate?.spatialSupport?.cellSpacingDegrees, row=candidate?.spatialSupport?.gridRow, column=candidate?.spatialSupport?.gridColumn, box=studyArea?.boundingBox;
  if(!box||![spacing,row,column].every(Number.isFinite)||spacing<=0)return null;
  const minLatitude=box.minLatitude+row*spacing, minLongitude=box.minLongitude+column*spacing;
  return {minLatitude:Number(minLatitude.toFixed(10)),maxLatitude:Number(Math.min(minLatitude+spacing,box.maxLatitude).toFixed(10)),minLongitude:Number(minLongitude.toFixed(10)),maxLongitude:Number(Math.min(minLongitude+spacing,box.maxLongitude).toFixed(10))};
}
async function listRuns(kind) {
  const dir = kind === "discovery" ? "data/processed/discovery-runs" : "data/processed/comparison-runs";
  const pattern = /^[a-f0-9-]{16,64}\.json$/i;
  const names = await files(dir, pattern);
  const rows=await Promise.all(names.map(async (name) => {
    try { const x = await json(`${dir}/${name}`); return kind === "discovery" ? { runId:x.runId, createdAt:x.createdAt, status:x.status, missionId:x.missionId, candidateCount:x.candidates?.length ?? 0, configurationId:x.configurationId, studyArea:x.studyArea?.label } : { runId:x.runId, createdAt:x.createdAt, status:x.status, candidateCount:x.candidateCount, referenceCount:x.referenceDataset?.count, comparisonPairCount:x.comparisonPairCount, discoveryRunId:x.discoveryRun?.runId }; } catch { return null; }
  }));
  return rows.filter(Boolean).sort((a,b)=>String(b.createdAt??"").localeCompare(String(a.createdAt??"")));
}
async function getJob(jobId) {
  if (!runPattern.test(jobId)) return null;
  if (onVercel) {
    const row = await artifactStore.getJob(jobId);
    return row ? { ...row.payload, status: row.status, attempt: row.attempt, workflowRunId: row.workflow_run_id, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }
  return optional(`data/app-runtime/jobs/${jobId}.json`);
}
function childRun(args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => child.kill("SIGTERM"), Number(process.env.APP_JOB_TIMEOUT_MS ?? 180000));
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); if (code === 0) resolvePromise({ stdout, stderr }); else reject(new Error((stderr || stdout || `Child exited ${code}`).slice(-3000))); });
  });
}
function apiJobFromRow(row) {
  return row ? { ...row.payload, status: row.status, attempt: row.attempt, workflowRunId: row.workflow_run_id, createdAt: row.created_at, updatedAt: row.updated_at } : null;
}
function safeJobError(error) {
  return String(error?.message ?? error)
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@")
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[redacted-token]")
    .replace(/(password|token|secret|authorization)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .slice(-3000);
}
async function startDurableWorkflow(jobId, input) {
  const claim = await artifactStore.claimWorkflowStart(jobId);
  if (!claim) return apiJobFromRow(await artifactStore.getJob(jobId));
  const row = await artifactStore.getJob(jobId);
  const payload = { ...row.payload, status: "starting", attempt: claim.attempt, updatedAt: new Date().toISOString() };
  await artifactStore.updateJob(jobId, { status: "starting", payload });
  let workflowRunId;
  try {
    const [{ start }, { runTerraMatchJob }] = await Promise.all([import("workflow/api"), import("../server/workflows/terramatch-job.mjs")]);
    const workflowRun = await start(runTerraMatchJob, [jobId, input], {
      experimental_hook: { token: `terramatch-job:${jobId}:${claim.attempt}`, experimental_minRetention: "30 days" },
    });
    workflowRunId = workflowRun.runId;
  } catch (error) {
    const conflictingRunId = error?.conflictingRunId ?? error?.details?.conflictingRunId;
    if (conflictingRunId) {
      workflowRunId = conflictingRunId;
    } else {
      const failedPayload = { ...payload, status: "failed", failureStage: "workflow_start", error: safeJobError(error), updatedAt: new Date().toISOString() };
      await artifactStore.updateJob(jobId, { status: "failed", payload: failedPayload });
    }
  }
  // If the workflow started but the follow-up metadata write failed, leave the
  // row in `starting`. A stale claimant reuses the same attempt hook token and
  // recovers the original run rather than starting a duplicate.
  if (workflowRunId) await artifactStore.updateJob(jobId, { workflowRunId });
  return apiJobFromRow(await artifactStore.getJob(jobId));
}
async function launchVercelJob(input, selected, mission, idempotencyKey) {
  if (idempotencyKey != null && (typeof idempotencyKey !== "string" || idempotencyKey.length > 200 || !idempotencyKey.trim())) {
    throw Object.assign(new Error("Idempotency-Key must be a non-empty value of at most 200 characters."), { status: 400 });
  }
  const jobId = randomUUID();
  const createdAt = new Date().toISOString();
  const area = selected.item.studyArea;
  const job = {
    schemaVersion:"1.0.0", jobId, createdAt, updatedAt:createdAt, status:"queued", attempt:0,
    missionId:mission.id, missionName:mission.name, studyAreaId:area.id, studyAreaLabel:area.label,
    studyAreaFile:selected.file, configurationStatus:selected.item.configurationStatus ?? "user_configured",
    stages:[
      {id:"configuration_validation",status:"completed",message:"Request, mission profile and allowlisted study area validated."},
      {id:"discovery",status:"queued",message:"Bounded provider retrieval and evidence screening."},
      {id:"discovery_validation",status:"queued",message:"Validate this exact discovery run and its archived output."},
      {id:"comparison",status:"queued",message:"Factor-level comparisons against the current point-eligible references."},
      {id:"comparison_validation",status:"queued",message:"Validate comparison relationships and factor states."},
    ],
    logs:[], discoveryRunId:null, discoveryValidation:null, comparisonRunId:null, comparisonValidation:null, failureStage:null, error:null,
  };
  const row = await artifactStore.createJob(job, idempotencyKey?.trim() || null);
  if (["queued", "retrying", "starting"].includes(row.status)) {
    return startDurableWorkflow(row.job_id, { missionId:mission.id, studyAreaId:area.id, studyAreaFile:selected.file });
  }
  return apiJobFromRow(row);
}
async function launchJob(input, request) {
  if(!input||typeof input!=="object"||Array.isArray(input))throw Object.assign(new Error("Request must contain missionId and studyAreaId."),{status:400});
  if (!onVercel && activeJob) throw Object.assign(new Error("A discovery job is already running."), { status: 409 });
  const profile = await json("data/mission-profiles/mars-surface-v1.json");
  const mission = profile.missions.find((item) => item.id === input.missionId);
  if (!mission) throw Object.assign(new Error("Select a mission in the configured Mars profile."), { status: 400 });
  const areaFiles = await files("data/discovery/study-areas", /^[-A-Za-z0-9_]+\.json$/);
  let selected = null;
  for (const file of areaFiles) { const item = await json(`data/discovery/study-areas/${file}`); if (item.studyArea?.id === input.studyAreaId) selected = { file, item }; }
  if (!selected) throw Object.assign(new Error("Study area is not allowlisted."), { status: 400 });
  const area = selected.item.studyArea;
  const box = area.boundingBox;
  if (![box.minLatitude,box.maxLatitude,box.minLongitude,box.maxLongitude,area.spacingDegrees].every(Number.isFinite) || box.minLatitude < -90 || box.maxLatitude > 90 || box.minLongitude < -180 || box.maxLongitude > 180 || area.maxCandidates > 100 || area.maxCandidates < 1) throw Object.assign(new Error("Configured study area failed API bounds checks."), { status: 400 });
  if(selected.item.providerRequestLimit!=null&&(!Number.isInteger(selected.item.providerRequestLimit)||selected.item.providerRequestLimit<1||area.maxCandidates*3>selected.item.providerRequestLimit))throw Object.assign(new Error("Configured study area exceeds its declared maximum provider request budget."),{status:400});
  if (onVercel) return launchVercelJob(input, selected, mission, request.headers["idempotency-key"]);
  activeJob = true;
  const jobId = randomUUID(); const createdAt = new Date().toISOString();
  const discoveryOutput = `data/app-runtime/discovery-runs/${jobId}.json`;
  const job = { schemaVersion:"1.0.0", jobId, createdAt, updatedAt:createdAt, status:"queued", missionId:mission.id, missionName:mission.name, studyAreaId:area.id, studyAreaLabel:area.label, configurationStatus:selected.item.configurationStatus ?? "user_configured", stages:[{id:"configuration_validation",status:"completed",message:"Request, mission profile and allowlisted study area validated."},{id:"discovery",status:"queued",message:"Bounded provider retrieval and evidence screening."},{id:"discovery_validation",status:"queued",message:"Validate this exact discovery run and its archived output."},{id:"comparison",status:"queued",message:"Factor-level comparisons against current reference inventory."},{id:"comparison_validation",status:"queued",message:"Validate comparison relationships and factor states."}], logs:[], discoveryRunId:null, discoveryValidation:null, comparisonRunId:null, comparisonValidation:null, failureStage:null, error:null };
  await mkdir(jobsDir,{recursive:true}); await mkdir(outputDir,{recursive:true}); await mkdir(join(root,"data/app-runtime/discovery-runs"),{recursive:true});
  await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
  void (async () => {
    try {
      job.status="running"; job.updatedAt=new Date().toISOString(); job.stages[1].status="running"; await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
      const result = await childRun(["dist/scripts/run-discovery.js"], { DISCOVERY_STUDY_AREA:`data/discovery/study-areas/${selected.file}`, DISCOVERY_MISSION_ID:mission.id, DISCOVERY_OUTPUT:discoveryOutput });
      const generated = JSON.parse(result.stdout); const discoveryRun=await json(discoveryOutput); job.discoveryRunId=generated.runId;
      if (discoveryRun.runId !== generated.runId) throw Object.assign(new Error("Discovery output identity did not match the runner result."),{stage:"discovery_validation"});
      job.logs.push({stage:"discovery",text:result.stdout.slice(-5000)}); job.stages[1]={id:"discovery",status:"completed",message:`Discovery run ${generated.runId} completed with ${generated.candidates?.length ?? 0} candidate record(s).`};
      job.stages[2].status="running"; job.updatedAt=new Date().toISOString(); await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
      const runReportPath=`data/processed/discovery-runs/validation-reports/${generated.runId}.json`;
      const validation = await childRun(["dist/scripts/validate-discovery.js"], { DISCOVERY_OUTPUT:discoveryOutput, DISCOVERY_VALIDATION_OUTPUT:runReportPath });
      const report=JSON.parse(await readFile(join(root,runReportPath),"utf8")); job.discoveryValidation={runId:report.runId,status:report.status,errors:report.errors};
      if(report.runId!==generated.runId||report.status!=="valid") throw Object.assign(new Error(`Discovery validation ${report.status} for run ${generated.runId}: ${(report.errors??[]).join("; ")||"run identity mismatch"}`),{stage:"discovery_validation"});
      const latestReport={...report,sourceRunPath:"data/processed/discovery-runs/latest.json"};
      await atomic("data/processed/discovery-runs/latest.json",discoveryRun);
      await atomic("data/processed/discovery-runs/validation-report.json",latestReport);
      job.logs.push({stage:"discovery_validation",text:validation.stdout.slice(-5000)}); job.stages[2]={id:"discovery_validation",status:"completed",message:`Discovery run ${generated.runId} passed validation.`};
      job.stages[3].status="running"; job.updatedAt=new Date().toISOString(); await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
      const compared = await childRun(["dist/scripts/run-comparison.js"], { DISCOVERY_OUTPUT:discoveryOutput });
      const comparison = JSON.parse(compared.stdout); job.comparisonRunId=comparison.runId; job.logs.push({stage:"comparison",text:compared.stdout.slice(-5000)}); job.stages[3]={id:"comparison",status:"completed",message:`Comparison run ${comparison.runId} generated for discovery ${generated.runId}.`};
      job.stages[4].status="running"; job.updatedAt=new Date().toISOString(); await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
      const comparedValidation = await childRun(["dist/scripts/validate-comparison.js"]);
      const comparisonReport=JSON.parse(await readFile(join(root,"data/processed/comparison-runs/validation-report.json"),"utf8"));
      job.comparisonValidation={runId:comparisonReport.runId,status:comparisonReport.status,errors:comparisonReport.errors};
      if(comparisonReport.runId!==comparison.runId||comparisonReport.status!=="valid") throw Object.assign(new Error(`Comparison validation ${comparisonReport.status} for run ${comparison.runId}: ${(comparisonReport.errors??[]).join("; ")||"run identity mismatch"}`),{stage:"comparison_validation"});
      job.logs.push({stage:"comparison_validation",text:comparedValidation.stdout.slice(-5000)}); job.stages[4]={id:"comparison_validation",status:"completed",message:`Comparison run ${comparison.runId} passed validation against discovery ${generated.runId}.`};
      job.status="completed"; job.updatedAt=new Date().toISOString(); await atomic(`data/app-runtime/jobs/${jobId}.json`,job);
    } catch (error) { job.status="failed"; job.failureStage=error?.stage??job.stages.find((s)=>s.status==="running")?.id??"execution"; job.error=String(error?.message ?? error).slice(0,3000); job.updatedAt=new Date().toISOString(); const pending=job.stages.find((s)=>s.status==="running"); if(pending)pending.status="failed"; await atomic(`data/app-runtime/jobs/${jobId}.json`,job); }
    finally { activeJob=false; }
  })();
  return job;
}

export async function handleApiRequest(req, res) {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (applyApiCors(req, res, url.pathname)) return;
    if (req.method === "GET" && url.pathname === "/api/health") return send(res,200,{status:"ok",app:"TerraMatch",planetaryScope:"Mars",apiVersion:"1.0.0"});
    if (url.pathname.startsWith("/api/")) {
      if(req.method==="GET"&&url.pathname==="/api/jobs"){
        if (onVercel) {
          const jobs = (await artifactStore.listJobs()).map((row) => ({ ...row.payload, status: row.status, attempt: row.attempt, workflowRunId: row.workflow_run_id, createdAt: row.created_at, updatedAt: row.updated_at }));
          return send(res,200,{jobs});
        }
        const names=await files("data/app-runtime/jobs",/^[a-f0-9-]{16,64}\.json$/i);const jobs=await Promise.all(names.map((name)=>optional(`data/app-runtime/jobs/${name}`)));return send(res,200,{jobs:jobs.filter(Boolean)});
      }
      const retryMatch=url.pathname.match(/^\/api\/jobs\/([^/]+)\/retry$/);
      if(req.method==="POST"&&retryMatch&&onVercel){
        const jobId=decodeURIComponent(retryMatch[1]);if(!runPattern.test(jobId))return send(res,400,{error:"Invalid job ID."});
        const retry=await artifactStore.queueJobRetry(jobId);if(!retry)return send(res,409,{error:"Only a failed job can be retried."});
        const retryPayload={...retry.payload,status:"retrying",workflowRunId:null,updatedAt:new Date().toISOString()};
        await artifactStore.updateJob(jobId,{status:"retrying",payload:retryPayload});
        const job=await startDurableWorkflow(jobId,{missionId:retry.payload.missionId,studyAreaId:retry.payload.studyAreaId,studyAreaFile:retry.payload.studyAreaFile});
        return send(res,202,job);
      }
      const jobMatch=url.pathname.match(/^\/api\/jobs\/([^/]+)$/);if(req.method==="GET"&&jobMatch){const job=await getJob(jobMatch[1]);return job?send(res,200,job):send(res,404,{error:"Job not found."});}
      if(req.method==="GET"&&url.pathname==="/api/discovery-runs")return send(res,200,{runs:await listRuns("discovery")});
      if(req.method==="GET"&&url.pathname==="/api/comparison-runs")return send(res,200,{runs:await listRuns("comparison")});
      const artifacts = await currentArtifacts();
      if (req.method === "GET" && url.pathname === "/api/summary") {
        const discovery=artifacts.discovery, comparison=artifacts.comparison;
        const candidates=(discovery?.candidates??[]).filter((c)=>c.recordType==="candidate_region");
        const factorStatusCounts={};for(const pair of comparison?.comparisons??[])for(const factor of pair.factors??[])factorStatusCounts[factor.status]=(factorStatusCounts[factor.status]??0)+1;
        const latestDiscovery=discovery?{runId:discovery.runId,configurationId:discovery.configurationId,createdAt:discovery.createdAt,status:discovery.status,missionId:discovery.missionId,missionProfileId:discovery.missionProfileId,studyArea:discovery.studyArea,studyAreaConfigurationStatus:discovery.studyAreaConfigurationStatus,generatedCellCount:discovery.generatedCellCount,excludedReferenceOverlapCount:discovery.excludedReferenceOverlapCount,candidates:candidates.map((c)=>({id:c.id,recordType:c.recordType,latitude:c.latitude,longitude:c.longitude,coordinatesApproximate:c.coordinatesApproximate,status:c.status,spatialSupport:c.spatialSupport,cellBounds:candidateCellBounds(c,discovery.studyArea),screening:c.screening,sources:Object.fromEntries(Object.entries(c.sources??{}).map(([key,value])=>[key,{status:value?.status,provider:value?.provider,error:value?.error}]))}))}:null;
        const latestComparison=comparison?{runId:comparison.runId,createdAt:comparison.createdAt,status:comparison.status,candidateCount:comparison.candidateCount,comparisonPairCount:comparison.comparisonPairCount,referenceDataset:{count:comparison.referenceDataset?.count},factorStatusCounts}:null;
        const discoveryValidation=validationState(artifacts.discoveryValidation,discovery);
        const comparisonValidation=validationState(artifacts.comparisonValidation,comparison);
        if(comparison&&discovery&&comparison.discoveryRun?.runId!==discovery.runId)comparisonValidation.status="stale_discovery_relationship";
        return send(res,200,{referenceCount:artifacts.references.length,fixtureCount:artifacts.fixtures.length,candidateCount:candidates.length,comparisonPairCount:comparison?.comparisonPairCount ?? 0,latestDiscoveryRunId:discovery?.runId ?? null,latestComparisonRunId:comparison?.runId ?? null,latestDiscovery,latestComparison,latestDiscoveryValidation:discoveryValidation,latestComparisonValidation:comparisonValidation});
      }
      if (req.method === "GET" && url.pathname === "/api/references") return send(res,200,{schemaVersion:"1.0.0",recordType:"known_analog",records:artifacts.references.map((r)=>{const d=displayReference(r);const curation=displayCuration(artifacts.curation.find((item)=>item.stableId===r.id));return{id:d.id,recordType:d.recordType,regionName:d.regionName,country:d.country,latitude:d.latitude,longitude:d.longitude,coordinatesApproximate:d.coordinatesApproximate,spatialGranularity:d.latitude==null||d.longitude==null?"region_level":"point_or_area",climate:d.climate,terrain:d.terrain,geology:d.geology,provenance:d.provenance,limitations:d.dataQuality?.warnings ?? [],curation,evidenceSummary:evidenceSummaryFor(r.id,artifacts.evidence)};})});
      if(req.method==="GET"&&url.pathname==="/api/evidence/coverage"){const coverage=await optional("data/evidence/evidence-coverage-v1.json");return coverage?send(res,200,coverage):send(res,404,{error:"Evidence coverage report is not available."});}
      const evidenceMatch=url.pathname.match(/^\/api\/references\/([^/]+)\/evidence$/);if(req.method==="GET"&&evidenceMatch){const id=decodeURIComponent(evidenceMatch[1]);if(!idPattern.test(id))return send(res,400,{error:"Invalid reference ID."});const evidence=await optional("data/evidence/evidence-registry-v1.json");if(!evidence)return send(res,404,{error:"Unified evidence registry is not available."});const records=(evidence.records??[]).filter((item)=>item.siteId===id);const supplementalRecords=(evidence.supplementalRecords??[]).filter((item)=>item.siteId===id);return send(res,200,{schemaVersion:evidence.schemaVersion,evidenceModelVersion:evidence.evidenceModelVersion,siteId:id,curationDecision:evidence.records.find((item)=>item.siteId===id)?.curationDecision??null,pointComparisonEligible:evidence.records.find((item)=>item.siteId===id)?.pointComparisonEligible===true,records,supplementalRecords});}
      if (req.method === "GET" && url.pathname.startsWith("/api/references/")) { const id=decodeURIComponent(url.pathname.slice("/api/references/".length)); if(!idPattern.test(id)) return send(res,400,{error:"Invalid reference ID."}); const record=artifacts.references.find((r)=>r.id===id); return record?send(res,200,{...displayReference(record),curation:displayCuration(artifacts.curation.find((item)=>item.stableId===id)),evidenceSummary:evidenceSummaryFor(id,artifacts.evidence)}):send(res,404,{error:"Reference not found."}); }
      if (req.method === "GET" && url.pathname === "/api/profile") return send(res,200,englishDisplayValue(artifacts.profile));
      if (req.method === "GET" && url.pathname === "/api/study-areas") { const names=await files("data/discovery/study-areas",/^[-A-Za-z0-9_]+\.json$/); const records=await Promise.all(names.map((name)=>json(`data/discovery/study-areas/${name}`))); return send(res,200,englishDisplayValue({studyAreas:records.map((r)=>({schemaVersion:r.schemaVersion,configurationStatus:r.configurationStatus,demonstrationRationale:r.demonstrationRationale??null,providerRequestLimit:r.providerRequestLimit??null,scientificLimitations:r.scientificLimitations,studyArea:r.studyArea}))})); }
      if (req.method === "GET" && url.pathname === "/api/discovery-runs") return send(res,200,{runs:await listRuns("discovery")});
      if (req.method === "GET" && url.pathname === "/api/comparison-runs") return send(res,200,{runs:await listRuns("comparison")});
      if (req.method === "GET" && url.pathname === "/api/discovery-runs/latest") return artifacts.discovery?send(res,200,englishDisplayValue(artifacts.discovery)):send(res,404,{error:"No discovery run is stored."});
      if (req.method === "GET" && url.pathname === "/api/comparison-runs/latest") return artifacts.comparison?sendComparisonRun(res,artifacts.comparison,url):send(res,404,{error:"No comparison run is stored."});
      const runMatch=url.pathname.match(/^\/api\/(discovery|comparison)-runs\/([^/]+)$/); if(req.method==="GET"&&runMatch){const [,kind,id]=runMatch;if(!runPattern.test(id))return send(res,400,{error:"Invalid run ID."});const path=kind==="discovery"?`data/processed/discovery-runs/${id}.json`:`data/processed/comparison-runs/${id}.json`;const item=await optional(path);return item?(kind==="comparison"?sendComparisonRun(res,item,url):send(res,200,englishDisplayValue(item))):send(res,404,{error:"Run not found."});}
      if(req.method==="POST"&&url.pathname==="/api/jobs"){const body=await readBody(req);const job=await launchJob(body,req);return send(res,202,job);}
      const candidateClimateMatch=url.pathname.match(/^\/api\/candidates\/([^/]+)\/climate$/);
      if(req.method==="GET"&&candidateClimateMatch){
        const id=decodeURIComponent(candidateClimateMatch[1]);if(!idPattern.test(id))return send(res,400,{error:"Invalid candidate ID."});
        const runId=url.searchParams.get("run");if(runId&&!runPattern.test(runId))return send(res,400,{error:"Invalid discovery run ID."});
        const run=runId?await optional(`data/processed/discovery-runs/${runId}.json`):artifacts.discovery;
        const candidate=run?.candidates?.find((x)=>x.id===id&&x.recordType==="candidate_region");if(!candidate)return send(res,404,{error:"Candidate not found in a stored discovery run."});
        const historyPath=candidate.sources?.climate?.normalizedDailyPath;if(!historyPath)return send(res,404,{error:"Daily climate history is not available for this candidate."});
        const key=artifactKey(historyPath), pageRoot=key.replace(/-daily\.json$/,"-daily-pages");
        let index=await optional(`${pageRoot}/index.json`), daily={};
        const offsetValue=Number(url.searchParams.get("offset")??0), limitValue=Number(url.searchParams.get("limit")??400);
        const offset=Number.isInteger(offsetValue)?Math.max(0,offsetValue):0, limit=Number.isInteger(limitValue)?Math.max(1,Math.min(500,limitValue)):400;
        if(index){
          const page=index.pages.find((item)=>offset>=item.offset&&offset<item.offset+item.count);
          if(page){const data=await json(`${pageRoot}/${page.file}`);const entries=Object.entries(data.daily??{}).sort(([a],[b])=>a.localeCompare(b));const skip=offset-page.offset;daily=Object.fromEntries(entries.slice(skip,skip+limit));}
          const metadata={...index};delete metadata.pages;
          return send(res,200,{history:{...metadata,daily},offset,limit,nextOffset:offset+Object.keys(daily).length<index.recordCount?offset+Object.keys(daily).length:null});
        }
        const full=await optional(key);if(!full)return send(res,404,{error:"Daily climate history is not available for this candidate."});
        const entries=Object.entries(full.daily??{}).sort(([a],[b])=>a.localeCompare(b));
        daily=Object.fromEntries(entries.slice(offset,offset+limit));
        const metadata={...full};delete metadata.daily;
        return send(res,200,{history:{...metadata,daily},offset,limit,nextOffset:offset+Object.keys(daily).length<entries.length?offset+Object.keys(daily).length:null});
      }
      const candidateMatch=url.pathname.match(/^\/api\/candidates\/([^/]+)\/evidence$/);if(req.method==="GET"&&candidateMatch){const id=decodeURIComponent(candidateMatch[1]);if(!idPattern.test(id))return send(res,400,{error:"Invalid candidate ID."});const runId=url.searchParams.get("run");if(runId&&!runPattern.test(runId))return send(res,400,{error:"Invalid discovery run ID."});const run=runId?await optional(`data/processed/discovery-runs/${runId}.json`):artifacts.discovery;const candidate=run?.candidates?.find((x)=>x.id===id&&x.recordType==="candidate_region");if(!candidate)return send(res,404,{error:"Candidate not found in a stored discovery run."});const climateRef=candidate.sources?.climate?.normalizedDailyPath?artifactKey(candidate.sources.climate.normalizedDailyPath):null;let climateSummary=null;if(climateRef){const pageIndex=await optional(climateRef.replace(/-daily\.json$/,"-daily-pages")+"/index.json");if(pageIndex){climateSummary={...pageIndex};delete climateSummary.pages;}else{const full=await optional(climateRef);if(full){climateSummary={...full};delete climateSummary.daily;}}}return send(res,200,{candidate:{...candidate,cellBounds:candidateCellBounds(candidate,run.studyArea),missionId:run.missionId,missionProfileId:run.missionProfileId,studyArea:run.studyArea,discoveryRunId:run.runId,referenceMasking:run.referenceMasking??null},sources:{climate:climateSummary,terrain:candidate.sources?.terrain??null,geology:candidate.sources?.geology??null}});}
      return send(res,404,{error:"API route not found."});
    }
    const webRoot=resolve(root,"web-dist");const requested=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname);const resolved=resolve(webRoot,`.${normalize(requested)}`);if(!resolved.startsWith(webRoot+sep)&&resolved!==webRoot)return send(res,400,{error:"Invalid path."});let target=resolved;try{await access(target);}catch{target=join(webRoot,"index.html");}try{const data=await readFile(target);const ext=extname(target);const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".json":"application/json"}[ext]??"application/octet-stream";res.writeHead(200,{"content-type":mime});res.end(data);}catch{return send(res,404,{error:"Frontend build not found. Run npm run build:web."});}
  } catch(error) { if (process.env.NODE_ENV !== "production") console.error(error); send(res,error?.status??500,{error:error?.status?error.message:"Request could not be completed."}); }
}

// The Vercel Function imports this handler and must not start a server. Local
// development keeps the existing long-running HTTP server behavior.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\//, ""));
if (!onVercel && invokedDirectly) {
  const server = createServer(handleApiRequest);
  server.requestTimeout = 15000;
  server.listen(port, host, () => console.log(`TerraMatch API listening at http://${host}:${port}`));
}
