import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createVercelArtifactStoreFromEnvironment } from "../../scripts/storage/vercel-json-artifact-store.mjs";
import { useStorage } from "nitro/storage";
import { hydrateJobRunnerAssets } from "./job-runner-assets.mjs";
import { createCompletedPayload } from "./job-retry-state.mjs";

const FIXED_INPUTS = [
  "processed/reference-sites.json",
  "processed/candidate-points.json",
  "curation/reference-curation-v1.json",
  "mission-profiles/mars-surface-v1.json",
  "processed/climate/known-sites-daily.json",
  "processed/terrain/elevation-samples.json",
  "processed/geology/known-sites-glim.json",
  "processed/supplementary-evidence/DALL-climate.json",
  "processed/supplementary-evidence/DAL-climate.json",
  "processed/supplementary-evidence/AHS-GH-climate.json",
  "processed/supplementary-evidence/DALL-terrain.json",
  "processed/supplementary-evidence/DAL-terrain.json",
  "processed/supplementary-evidence/AHS-GH-terrain.json",
  "processed/supplementary-evidence/DALL-geology.json",
  "processed/supplementary-evidence/DAL-geology.json",
  "processed/supplementary-evidence/AHS-GH-geology.json",
];

async function withStore(action) {
  const store = await createVercelArtifactStoreFromEnvironment();
  try { await store.ensureSchema(); return await action(store); }
  finally { await store.pool.end(); }
}

async function jobState(store, jobId, status, stageId, patch = {}, stageStatus = status) {
  const row = await store.getJob(jobId);
  if (!row) throw new Error(`Durable job ${jobId} disappeared.`);
  const payload = {
    ...row.payload,
    ...patch,
    status,
    updatedAt: new Date().toISOString(),
    stages: (row.payload.stages ?? []).map((stage) => stage.id === stageId
      ? { ...stage, status: stageStatus, updatedAt: new Date().toISOString() }
      : stage),
  };
  const updated = await store.updateJob(jobId, { status, payload });
  if (!updated) throw new Error(`Could not update durable job ${jobId}.`);
  return payload;
}

async function writeInput(store, workspace, key, { optional = false } = {}) {
  let bytes;
  try { bytes = await store.readBytes(key); }
  catch (error) {
    if (optional && error?.code === "ENOENT") return false;
    throw error;
  }
  const path = join(workspace, "data", ...key.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return true;
}

async function hydrate(store, workspace, keys) {
  for (const key of keys) await writeInput(store, workspace, key, { optional: true });
}

async function hydrateProviderCache(store, workspace) {
  for (const prefix of ["cache/nasa-power", "raw/nasa-power", "raw/copernicus-dem", "raw/glim"]) {
    for (const name of await store.listNames(prefix, /^[A-Za-z0-9_.-]+\.json$/)) {
      await writeInput(store, workspace, `${prefix}/${name}`, { optional: true });
    }
  }
}

function runRunner(name, workspace, env = {}) {
  const script = resolve(workspace, "build/job-runners", `${name}.mjs`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: workspace,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-20000); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-20000); });
    const timeout = setTimeout(() => child.kill(), 270_000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error((stderr || stdout || `Runner ${name} exited ${code ?? signal}`).slice(-5000)));
    });
  });
}

async function walkFiles(directory) {
  const result = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return result; throw error; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walkFiles(path));
    else if (entry.isFile() && !entry.name.endsWith(".tmp")) result.push(path);
  }
  return result;
}

async function uploadWorkspaceTree(store, workspace, relativeDirectory, immutable) {
  const absoluteDirectory = join(workspace, "data", ...relativeDirectory.split("/"));
  const paths = await walkFiles(absoluteDirectory);
  for (const path of paths) {
    const key = path.slice(join(workspace, "data").length + 1).split(/[\\/]/g).join("/");
    const bytes = await readFile(path);
    if (immutable) await store.writeBytesImmutable(key, bytes);
    else await store.writeBytesAtomic(key, bytes);
  }
}

async function writeClimatePages(store, artifactKey, history) {
  const entries = Object.entries(history.daily ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const pageSize = 400;
  const pageRoot = artifactKey.replace(/-daily\.json$/, "-daily-pages");
  const pages = [];
  for (let offset = 0; offset < entries.length; offset += pageSize) {
    const slice = entries.slice(offset, offset + pageSize);
    const file = `${String(pages.length).padStart(4, "0")}.json`;
    await store.writeJsonImmutable(`${pageRoot}/${file}`, { daily: Object.fromEntries(slice) });
    pages.push({ file, offset, count: slice.length });
  }
  const { daily: _daily, ...metadata } = history;
  await store.writeJsonImmutable(`${pageRoot}/index.json`, { ...metadata, recordCount: entries.length, pageSize, pages });
}

async function runDiscovery(jobId, input) {
  "use step";
  return withStore(async (store) => {
    const payload = await jobState(store, jobId, "running", "discovery");
    const workspace = await mkdtemp(join(tmpdir(), `terramatch-${jobId}-discovery-`));
    try {
      await hydrateJobRunnerAssets(useStorage("assets:job-runners"), workspace);
      await hydrate(store, workspace, [
        ...FIXED_INPUTS.slice(0, 4),
        `discovery/study-areas/${input.studyAreaFile}`,
      ]);
      await hydrateProviderCache(store, workspace);
      await mkdir(join(workspace, "data", "app-runtime", "discovery-runs"), { recursive: true });
      const outputPath = `data/app-runtime/discovery-runs/${jobId}.json`;
      const { stdout, stderr } = await runRunner("run-discovery", workspace, {
        DISCOVERY_STUDY_AREA: `data/discovery/study-areas/${input.studyAreaFile}`,
        DISCOVERY_MISSION_ID: input.missionId,
        DISCOVERY_OUTPUT: outputPath,
      });
      const result = JSON.parse(stdout);
      const run = JSON.parse(await readFile(join(workspace, outputPath), "utf8"));
      if (result.runId !== run.runId) throw new Error("Discovery runner output identity did not match its archived run.");
      await uploadWorkspaceTree(store, workspace, `processed/discovery-runs`, true);
      await uploadWorkspaceTree(store, workspace, `processed/climate/candidates`, true);
      await uploadWorkspaceTree(store, workspace, `raw/copernicus-dem`, true);
      await uploadWorkspaceTree(store, workspace, `raw/glim`, true);
      await uploadWorkspaceTree(store, workspace, `raw/nasa-power`, true);
      await uploadWorkspaceTree(store, workspace, `cache/nasa-power`, false);
      await store.writeBytesImmutable(outputPath.replace(/^data\//, ""), Buffer.from(`${JSON.stringify(run, null, 2)}\n`));
      for (const candidate of run.candidates ?? []) {
        const historyPath = candidate.recordType === "candidate_region" ? candidate.sources?.climate?.normalizedDailyPath : null;
        if (!historyPath || !historyPath.startsWith("data/processed/climate/candidates/") || !historyPath.endsWith("-daily.json")) continue;
        const history = JSON.parse(await readFile(join(workspace, ...historyPath.split("/")), "utf8"));
        await writeClimatePages(store, historyPath.replace(/^data\//, ""), history);
      }
      await jobState(store, jobId, "running", "discovery", {
        discoveryRunId: run.runId,
        logs: [...(payload.logs ?? []), { stage: "discovery", text: `${stdout}${stderr}`.slice(-5000) }],
      }, "completed");
      return run.runId;
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });
}

async function validateDiscovery(jobId, discoveryRunId) {
  "use step";
  return withStore(async (store) => {
    await jobState(store, jobId, "running", "discovery_validation");
    const workspace = await mkdtemp(join(tmpdir(), `terramatch-${jobId}-validate-discovery-`));
    try {
      await hydrateJobRunnerAssets(useStorage("assets:job-runners"), workspace);
      const runKey = `processed/discovery-runs/${discoveryRunId}.json`;
      await hydrate(store, workspace, [...FIXED_INPUTS.slice(0, 2), "curation/reference-curation-v1.json", runKey, `app-runtime/discovery-runs/${jobId}.json`]);
      const run = await store.readJson(runKey);
      const outputPath = `data/app-runtime/discovery-runs/${jobId}.json`;
      await mkdir(join(workspace, "data", "app-runtime", "discovery-runs"), { recursive: true });
      await writeFile(join(workspace, outputPath), `${JSON.stringify(run, null, 2)}\n`);
      const reportPath = `data/processed/discovery-runs/validation-reports/${discoveryRunId}.json`;
      const { stdout } = await runRunner("validate-discovery", workspace, { DISCOVERY_OUTPUT: outputPath, DISCOVERY_VALIDATION_OUTPUT: reportPath });
      const report = JSON.parse(await readFile(join(workspace, reportPath), "utf8"));
      if (report.runId !== discoveryRunId || report.status !== "valid") throw new Error(`Discovery validation failed for ${discoveryRunId}: ${(report.errors ?? []).join("; ")}`);
      await store.writeJsonImmutable(reportPath.replace(/^data\//, ""), report);
      await jobState(store, jobId, "running", "discovery_validation", {
        discoveryValidation: { runId: report.runId, status: report.status, errors: report.errors },
        logs: [{ stage: "discovery_validation", text: stdout.slice(-5000) }],
      }, "completed");
      return { runId: report.runId, status: report.status };
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });
}

async function runComparison(jobId, discoveryRunId) {
  "use step";
  return withStore(async (store) => {
    await jobState(store, jobId, "running", "comparison");
    const workspace = await mkdtemp(join(tmpdir(), `terramatch-${jobId}-comparison-`));
    try {
      await hydrateJobRunnerAssets(useStorage("assets:job-runners"), workspace);
      const discoveryKey = `processed/discovery-runs/${discoveryRunId}.json`;
      const discovery = await store.readJson(discoveryKey);
      const candidateHistories = (discovery.candidates ?? [])
        .filter((candidate) => candidate.recordType === "candidate_region")
        .map((candidate) => candidate.sources?.climate?.normalizedDailyPath)
        .filter((key) => typeof key === "string" && key.startsWith("data/"));
      await hydrate(store, workspace, [...FIXED_INPUTS, "curation/reference-curation-v1.json", discoveryKey, ...candidateHistories.map((key) => key.replace(/^data\//, ""))]);
      await mkdir(join(workspace, "data", "processed", "discovery-runs"), { recursive: true });
      await writeFile(join(workspace, "data", "processed", "discovery-runs", "latest.json"), `${JSON.stringify(discovery, null, 2)}\n`);
      const { stdout } = await runRunner("run-comparison", workspace, { DISCOVERY_OUTPUT: `data/processed/discovery-runs/${discoveryRunId}.json` });
      const result = JSON.parse(stdout);
      const comparisonPath = `data/processed/comparison-runs/${result.runId}.json`;
      const comparison = JSON.parse(await readFile(join(workspace, comparisonPath), "utf8"));
      if (comparison.discoveryRun?.runId !== discoveryRunId) throw new Error("Comparison was generated against a different discovery run.");
      await store.writeJsonImmutable(comparisonPath.replace(/^data\//, ""), comparison);
      await jobState(store, jobId, "running", "comparison", { comparisonRunId: result.runId }, "completed");
      return result.runId;
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });
}

async function validateComparison(jobId, discoveryRunId, comparisonRunId) {
  "use step";
  return withStore(async (store) => {
    await jobState(store, jobId, "running", "comparison_validation");
    const workspace = await mkdtemp(join(tmpdir(), `terramatch-${jobId}-validate-comparison-`));
    try {
      await hydrateJobRunnerAssets(useStorage("assets:job-runners"), workspace);
      const discoveryKey = `processed/discovery-runs/${discoveryRunId}.json`;
      const comparisonKey = `processed/comparison-runs/${comparisonRunId}.json`;
      await hydrate(store, workspace, [...FIXED_INPUTS.slice(0, 2), "curation/reference-curation-v1.json", discoveryKey, comparisonKey]);
      const discovery = await store.readJson(discoveryKey);
      const comparison = await store.readJson(comparisonKey);
      await mkdir(join(workspace, "data", "processed", "discovery-runs"), { recursive: true });
      await mkdir(join(workspace, "data", "processed", "comparison-runs"), { recursive: true });
      await writeFile(join(workspace, "data", "processed", "discovery-runs", "latest.json"), `${JSON.stringify(discovery, null, 2)}\n`);
      await writeFile(join(workspace, "data", "processed", "comparison-runs", "latest.json"), `${JSON.stringify(comparison, null, 2)}\n`);
      const reportPath = `data/processed/comparison-runs/validation-reports/${comparisonRunId}.json`;
      const { stdout } = await runRunner("validate-comparison", workspace, {
        COMPARISON_OUTPUT: `data/processed/comparison-runs/${comparisonRunId}.json`,
        COMPARISON_VALIDATION_OUTPUT: reportPath,
        COMPARISON_REQUIRE_CURATION_POLICY: "true",
      });
      const report = JSON.parse(await readFile(join(workspace, reportPath), "utf8"));
      if (report.runId !== comparisonRunId || report.status !== "valid") throw new Error(`Comparison validation failed for ${comparisonRunId}: ${(report.errors ?? []).join("; ")}`);
      await store.writeJsonImmutable(reportPath.replace(/^data\//, ""), report);
      await jobState(store, jobId, "running", "comparison_validation", {
        comparisonValidation: { runId: report.runId, status: report.status, errors: report.errors },
        logs: [{ stage: "comparison_validation", text: stdout.slice(-5000) }],
      }, "completed");
      return { runId: report.runId, status: report.status };
    } finally { await rm(workspace, { recursive: true, force: true }); }
  });
}

async function publishJob(jobId, discoveryRunId, comparisonRunId) {
  "use step";
  return withStore(async (store) => {
    const row = await store.getJob(jobId);
    if (!row) throw new Error(`Durable job ${jobId} disappeared before publication.`);
    const payload = createCompletedPayload(row.payload, discoveryRunId, comparisonRunId);
    await store.publishValidatedJob({ jobId, discoveryRunId, comparisonRunId, jobPayload: payload });
    return { jobId, status: "completed", discoveryRunId, comparisonRunId };
  });
}

async function failJob(jobId, error) {
  "use step";
  return withStore(async (store) => {
    const row = await store.getJob(jobId);
    if (!row || row.status === "completed") return;
    const stage = row.payload.stages?.find((item) => item.status === "running")?.id ?? "execution";
    const payload = {
      ...row.payload,
      status: "failed",
      failureStage: stage,
      error: String(error?.message ?? error)
        .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@")
        .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[redacted-token]")
        .replace(/(password|token|secret|authorization)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
        .slice(-3000),
      updatedAt: new Date().toISOString(),
      stages: (row.payload.stages ?? []).map((item) => item.id === stage ? { ...item, status: "failed" } : item),
    };
    await store.updateJob(jobId, { status: "failed", payload });
  });
}

export async function runTerraMatchJob(jobId, input) {
  "use workflow";
  try {
    const discoveryRunId = await runDiscovery(jobId, input);
    const discoveryValidation = await validateDiscovery(jobId, discoveryRunId);
    if (discoveryValidation.status !== "valid") throw new Error(`Discovery run ${discoveryRunId} did not validate.`);
    const comparisonRunId = await runComparison(jobId, discoveryRunId);
    const comparisonValidation = await validateComparison(jobId, discoveryRunId, comparisonRunId);
    if (comparisonValidation.status !== "valid") throw new Error(`Comparison run ${comparisonRunId} did not validate.`);
    return await publishJob(jobId, discoveryRunId, comparisonRunId);
  } catch (error) {
    await failJob(jobId, error);
    throw error;
  }
}
