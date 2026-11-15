import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, test } from "node:test";

const probe=createServer();
await new Promise((resolve)=>probe.listen(0,"127.0.0.1",resolve));
const port=probe.address().port;
await new Promise((resolve)=>probe.close(resolve));
const server=spawn(process.execPath,["scripts/app-api.mjs"],{env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
let output="";server.stdout.on("data",(chunk)=>output+=chunk.toString());server.stderr.on("data",(chunk)=>output+=chunk.toString());
const base=`http://127.0.0.1:${port}`;
after(()=>server.kill());
async function waitForServer(){for(let attempt=0;attempt<50;attempt++){try{const response=await fetch(`${base}/api/health`);if(response.ok)return; }catch{} await new Promise((resolve)=>setTimeout(resolve,100));}throw new Error(`API failed to start: ${output}`);}

test("app API exposes validated project artifacts and rejects unsafe inputs",async()=>{
  await waitForServer();
  const health=await fetch(`${base}/api/health`).then((r)=>r.json());
  assert.equal(health.status,"ok");assert.equal(health.planetaryScope,"Mars");
  const summary=await fetch(`${base}/api/summary`).then((r)=>r.json());
  assert.equal(summary.referenceCount,31);assert.equal(summary.fixtureCount,3);
  assert.ok(summary.latestDiscoveryRunId);assert.equal(summary.latestDiscoveryRunId,summary.latestDiscovery.runId);
  assert.equal(summary.latestDiscoveryValidation.status,"valid");assert.equal(summary.latestDiscoveryValidation.runId,summary.latestDiscoveryRunId);
  assert.equal(summary.candidateCount,summary.latestDiscovery.candidates.length);
  assert.equal(summary.latestComparisonValidation.status,"valid");assert.equal(summary.latestComparisonValidation.runId,summary.latestComparisonRunId);
  const inventory=await fetch(`${base}/api/references`).then((r)=>r.json());
  assert.equal(inventory.records.length,31);assert.equal(inventory.recordType,"known_analog");assert.equal(inventory.records.some((r)=>r.recordType==="test_fixture"),false);
  assert.doesNotMatch(JSON.stringify(inventory),/[\u0600-\u06FF]/u);
  const referenceDetail=await fetch(`${base}/api/references/GKC`).then((r)=>r.json());assert.equal(referenceDetail.country,"Egypt");assert.doesNotMatch(JSON.stringify(referenceDetail),/[\u0600-\u06FF]/u);
  const region=inventory.records.find((r)=>r.id==="SEM");assert.equal(region.latitude,null);assert.equal(region.spatialGranularity,"region_level");
  const profile=await fetch(`${base}/api/profile`).then((r)=>r.json());assert.equal(profile.targetPlanet,"Mars");assert.ok(profile.missions.length>=1);assert.doesNotMatch(JSON.stringify(profile),/[\u0600-\u06FF]/u);
  const areas=await fetch(`${base}/api/study-areas`).then((r)=>r.json());const demo=areas.studyAreas.find((a)=>a.studyArea.id==="atacama-climate-transect-v2");assert.ok(demo);assert.equal(demo.studyArea.spacingDegrees,0.2);assert.equal(demo.studyArea.maxCandidates,4);assert.equal(demo.providerRequestLimit,12);assert.match(demo.configurationStatus,/demonstration/);assert.doesNotMatch(JSON.stringify(areas),/[\u0600-\u06FF]/u);
  const comparison=await fetch(`${base}/api/comparison-runs/latest`).then((r)=>r.json());assert.equal(comparison.comparisons.length,summary.candidateCount*summary.referenceCount);assert.equal(comparison.referenceDataset.count,31);assert.equal(comparison.referenceDataset.sites[0].country,"Egypt");assert.equal(comparison.discoveryRun.runId,summary.latestDiscoveryRunId);assert.doesNotMatch(JSON.stringify(comparison),/[\u0600-\u06FF]/u);assert.equal("score" in comparison,false);
  const factors=comparison.comparisons.flatMap((pair)=>pair.factors);assert.ok(factors.length>0);assert.ok(factors.every((factor)=>["compared","failed","unavailable","ambiguous","missing"].includes(factor.status)));
  const candidateRecord=summary.latestDiscovery.candidates.find((candidate)=>candidate.sources?.climate?.status==="success")??summary.latestDiscovery.candidates.find((candidate)=>candidate.recordType==="candidate_region"&&candidate.status!=="rejected_reference_overlap");
  const candidateId=candidateRecord.id;
  const candidate=await fetch(`${base}/api/candidates/${encodeURIComponent(candidateId)}/evidence`).then((r)=>r.json());assert.equal(candidate.candidate.recordType,"candidate_region");assert.equal(candidate.candidate.id,candidateId);assert.equal(candidate.sources.terrain.status,candidateRecord.sources.terrain.status);assert.doesNotMatch(JSON.stringify(candidate),/[\u0600-\u06FF]/u);
  const discovery=await fetch(`${base}/api/discovery-runs/latest`).then((r)=>r.json());assert.equal(discovery.runId,summary.latestDiscoveryRunId);assert.doesNotMatch(JSON.stringify(discovery),/[\u0600-\u06FF]/u);
  if(candidate.candidate.spatialSupport?.gridRow!==undefined){assert.ok(candidate.candidate.cellBounds);assert.equal(candidate.candidate.missionId,summary.latestDiscovery.missionId);}
  const unsafe=await fetch(`${base}/api/references/%2e%2e%2fpackage.json`);assert.equal(unsafe.status,400);
  const invalidJob=await fetch(`${base}/api/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({missionId:"not-a-mission",studyAreaId:"not-a-config"})});assert.equal(invalidJob.status,400);
  const tooLarge=await fetch(`${base}/api/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:" ".repeat(8200)});assert.equal(tooLarge.status,413);
  const discoveryRuns=await fetch(`${base}/api/discovery-runs`).then((r)=>r.json());assert.ok(discoveryRuns.runs.length>=1);
});
