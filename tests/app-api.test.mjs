import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const probe=createServer();
await new Promise((resolve)=>probe.listen(0,"127.0.0.1",resolve));
const port=probe.address().port;
await new Promise((resolve)=>probe.close(resolve));
const server=spawn(process.execPath,["scripts/app-api.mjs"],{env:{...process.env,PORT:String(port),CORS_ALLOWED_ORIGINS:"https://terramatch-blue.vercel.app"},stdio:["ignore","pipe","pipe"]});
let output="";server.stdout.on("data",(chunk)=>output+=chunk.toString());server.stderr.on("data",(chunk)=>output+=chunk.toString());
const base=`http://127.0.0.1:${port}`;
after(()=>server.kill());
async function waitForServer(){for(let attempt=0;attempt<50;attempt++){try{const response=await fetch(`${base}/api/health`);if(response.ok)return; }catch{} await new Promise((resolve)=>setTimeout(resolve,100));}throw new Error(`API failed to start: ${output}`);}
async function fetchComparison(path){const first=await fetch(`${base}${path}?offset=0&limit=12`).then((r)=>r.json());if(!first.pagination)return first;assert.ok(Buffer.byteLength(JSON.stringify(first))<4_000_000);const pages=await Promise.all(Array.from({length:Math.ceil(first.pagination.totalRecords/first.pagination.limit)-1},(_,index)=>fetch(`${base}${path.includes("/latest")?path.replace("/latest",`/${first.runId}`):path}?offset=${(index+1)*first.pagination.limit}&limit=${first.pagination.limit}`).then((r)=>r.json())));assert.ok(pages.every((page)=>page.runId===first.runId));return {...first,comparisons:[...first.comparisons,...pages.flatMap((page)=>page.comparisons)]};}

test("app API allows the configured frontend origin and handles preflight",async()=>{
  await waitForServer();
  const origin="https://terramatch-blue.vercel.app";
  const allowed=await fetch(`${base}/api/health`,{headers:{Origin:origin}});
  assert.equal(allowed.headers.get("access-control-allow-origin"),origin);
  const blocked=await fetch(`${base}/api/health`,{headers:{Origin:"https://untrusted.example"}});
  assert.equal(blocked.headers.get("access-control-allow-origin"),null);
  const preflight=await fetch(`${base}/api/jobs`,{method:"OPTIONS",headers:{Origin:origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,idempotency-key"}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get("access-control-allow-origin"),origin);
  assert.match(preflight.headers.get("access-control-allow-methods")??"",/POST/);
  assert.match(preflight.headers.get("access-control-allow-headers")??"",/idempotency-key/i);
});

test("app API exposes validated project artifacts and rejects unsafe inputs",async()=>{
  await waitForServer();
  const health=await fetch(`${base}/api/health`).then((r)=>r.json());
  assert.equal(health.status,"ok");assert.equal(health.planetaryScope,"Mars");
  const summary=await fetch(`${base}/api/summary`).then((r)=>r.json());
  assert.equal(summary.referenceCount,31);assert.equal(summary.fixtureCount,3);
  const moonSummaryResponse=await fetch(`${base}/api/moon/summary`);assert.equal(moonSummaryResponse.status,200);const moonSummary=await moonSummaryResponse.json();assert.equal(moonSummary.destination.id,"moon");assert.equal(moonSummary.counts.registered,1);assert.equal(moonSummary.counts.acquired,1);assert.equal(moonSummary.counts.decoded,1);assert.equal(moonSummary.counts.processed,1);assert.equal(moonSummary.counts.validated,0);assert.equal(moonSummary.counts.renderable,0);
  const moonDatasetsResponse=await fetch(`${base}/api/moon/datasets?offset=0&limit=100`);assert.equal(moonDatasetsResponse.status,200);const moonDatasets=await moonDatasetsResponse.json();assert.equal(moonDatasets.items.length,1);assert.equal(moonDatasets.pagination.total,1);assert.equal(moonDatasets.items[0].datasetId,"moon-lola-global-topography");assert.equal(moonDatasets.items.some((item)=>Object.keys(item).some((key)=>/path|token|credential/i.test(key))),false);
  const removedMoonDetail=await fetch(`${base}/api/moon/datasets/moon-usgs-unified-geology`);assert.equal(removedMoonDetail.status,404);
  const missingMoon=await fetch(`${base}/api/moon/datasets/not-registered`);assert.equal(missingMoon.status,404);assert.equal((await missingMoon.json()).code,"UNKNOWN_DATASET");
  const moonCoverage=await fetch(`${base}/api/moon/coverage`).then((r)=>r.json());assert.equal(moonCoverage.datasets.length,1);assert.ok(moonCoverage.datasets.every((item)=>item.validDataCoverage===null));
  const moonLayers=await fetch(`${base}/api/moon/layers`).then((r)=>r.json());assert.equal(moonLayers.renderableLayers.length,0);assert.equal(moonLayers.registeredButUnavailableLayers.length,1);
  const moonMap=await fetch(`${base}/api/moon/map-config`).then((r)=>r.json());assert.equal(moonMap.destinationId,"moon");assert.equal(moonMap.basemapId,null);assert.equal(moonMap.tileService,null);assert.equal(moonMap.prototype,true);
  const marsResponse=await fetch(`${base}/api/mars-evidence/rems`);assert.equal(marsResponse.status,200);const marsEvidence=await marsResponse.json();assert.equal(marsEvidence.dataset.datasetId,"MSL-M-REMS-5-MODRDR-V1.0");assert.equal(marsEvidence.qualityControl.validSampleCount+marsEvidence.qualityControl.rejectedSampleCount,marsEvidence.coverage.sourceRecordCount);assert.equal(marsEvidence.earthReferenceComparisons.length,8);assert.equal(marsEvidence.missionEvidenceGaps.length,4);assert.equal(Object.hasOwn(marsEvidence,"rawSamples"),false);assert.ok(marsEvidence.qualityControl.confidenceCharacterCounts.length===9);
  assert.ok(summary.latestDiscoveryRunId);assert.equal(summary.latestDiscoveryRunId,summary.latestDiscovery.runId);
  assert.equal(summary.latestDiscoveryValidation.runId,summary.latestDiscoveryRunId);assert.equal(summary.latestDiscoveryValidation.status,"valid");
  assert.equal(summary.candidateCount,summary.latestDiscovery.candidates.length);
  assert.equal(summary.latestComparisonValidation.runId,summary.latestComparisonRunId);assert.equal(summary.latestComparisonValidation.status,"valid");
  const inventory=await fetch(`${base}/api/references`).then((r)=>r.json());
  assert.equal(inventory.records.length,31);assert.equal(inventory.recordType,"known_analog");assert.equal(inventory.records.some((r)=>r.recordType==="test_fixture"),false);
  assert.equal(inventory.records.find((r)=>r.id==="DEV").curation.preliminaryDecision,"region_only");
  assert.equal(inventory.records.find((r)=>r.id==="DEV").curation.pointComparisonEligible,false);
  assert.equal(inventory.records.find((r)=>r.id==="MDRS").curation.preliminaryDecision,"keep_with_limitations");
  assert.doesNotMatch(JSON.stringify(inventory),/[\u0600-\u06FF]/u);
  const referenceDetail=await fetch(`${base}/api/references/GKC`).then((r)=>r.json());assert.equal(referenceDetail.country,"Egypt");assert.equal(referenceDetail.curation.preliminaryDecision,"keep_with_limitations");assert.doesNotMatch(JSON.stringify(referenceDetail),/[\u0600-\u06FF]/u);
  const referenceEvidence=await fetch(`${base}/api/references/GKC/evidence`).then((r)=>r.json());assert.equal(referenceEvidence.siteId,"GKC");assert.equal(referenceEvidence.pointComparisonEligible,true);assert.ok(referenceEvidence.records.length>=19);assert.equal(referenceEvidence.records.find((row)=>row.factorId==="air_temperature_daily_mean").value.mean>0,true);assert.equal(referenceEvidence.records.find((row)=>row.factorId==="elevation_point").value.value>0,true);assert.deepEqual(referenceEvidence.supplementalRecords,[]);assert.equal(referenceEvidence.records.some((row)=>Object.hasOwn(row,"rawResponseText")),false);assert.doesNotMatch(JSON.stringify(referenceEvidence),/[\u0600-\u06FF]/u);
  const etnaEvidence=await fetch(`${base}/api/references/ETN/evidence`).then((r)=>r.json());assert.equal(etnaEvidence.supplementalRecords.length,4);assert.ok(etnaEvidence.supplementalRecords.every((row)=>row.state==="not_representative"&&row.spatialRelationship==="regional_context"&&row.pointComparisonEligible===false&&row.latitude===null&&row.longitude===null&&row.recordContext.sampleCount===1&&row.recordContext.distinctLocationCount===null));assert.equal(etnaEvidence.supplementalRecords.some((row)=>Object.hasOwn(row,"rawResponseText")),false);
  const meteorEvidence=await fetch(`${base}/api/references/MET/evidence`).then((r)=>r.json());assert.equal(meteorEvidence.supplementalRecords.length,195);assert.ok(meteorEvidence.supplementalRecords.every((row)=>row.factorId===null&&row.pointComparisonEligible===false&&row.latitude===null&&row.longitude===null&&row.recordContext.sampleCount===15&&row.recordContext.measurementCount===null&&row.recordContext.reportedValueCount===180));assert.equal(new Set(meteorEvidence.supplementalRecords.map((row)=>row.sampleLabel)).size,15);assert.equal(meteorEvidence.supplementalRecords.filter((row)=>row.parameter==="Total").length,15);
  assert.equal(referenceDetail.evidenceSummary.factorCount,19);assert.equal(inventory.records.find((r)=>r.id==="GKC").evidenceSummary.factorCount,19);
  const coverage=await fetch(`${base}/api/evidence/coverage`).then((r)=>r.json());assert.equal(coverage.siteCount,31);assert.equal(coverage.factorCount,19);assert.equal(coverage.eligibleSiteIds.length,24);assert.equal(coverage.excludedSiteIds.length,7);assert.equal(coverage.supplementalRecordCount,199);assert.equal(coverage.siteSupplementalSummary.find((row)=>row.siteId==="ETN").byFactor.mineral_evidence,4);
  const region=inventory.records.find((r)=>r.id==="SEM");assert.equal(region.latitude,null);assert.equal(region.spatialGranularity,"region_level");
  const profile=await fetch(`${base}/api/profile`).then((r)=>r.json());assert.equal(profile.targetPlanet,"Mars");assert.equal(profile.missions.length,4);assert.doesNotMatch(JSON.stringify(profile),/[\u0600-\u06FF]/u);
  const areas=await fetch(`${base}/api/study-areas`).then((r)=>r.json());const demo=areas.studyAreas.find((a)=>a.studyArea.id==="atacama-climate-transect-v2");assert.ok(demo);assert.equal(demo.studyArea.spacingDegrees,0.2);assert.equal(demo.studyArea.maxCandidates,4);assert.equal(demo.providerRequestLimit,12);assert.match(demo.configurationStatus,/demonstration/);assert.doesNotMatch(JSON.stringify(areas),/[\u0600-\u06FF]/u);
  const comparison=await fetchComparison("/api/comparison-runs/latest");assert.equal(comparison.comparisons.length,summary.candidateCount*summary.latestComparison.referenceDataset.count);assert.equal(comparison.referenceDataset.count,24);assert.equal(comparison.referenceSelection.policyId,"reference-curation-v1-point-eligibility");assert.equal(comparison.referenceSelection.policyVersion,"1.0.0");assert.equal(comparison.referenceSelection.excludedReferenceIds.length,7);assert.equal(comparison.referenceDataset.sites[0].country,"Egypt");assert.equal(comparison.discoveryRun.runId,summary.latestDiscoveryRunId);assert.equal(comparison.discoveryRun.referenceEligibilityPolicyId,"reference-curation-v1-point-eligibility");assert.equal(comparison.discoveryRun.referenceEligibilityPolicyVersion,"1.0.0");assert.doesNotMatch(JSON.stringify(comparison),/[\u0600-\u06FF]/u);assert.equal("score" in comparison,false);
  const factors=comparison.comparisons.flatMap((pair)=>pair.factors);assert.ok(factors.length>0);assert.ok(factors.every((factor)=>["compared","failed","unavailable","ambiguous","missing"].includes(factor.status)));
  const candidateRecord=summary.latestDiscovery.candidates.find((candidate)=>candidate.sources?.climate?.status==="success")??summary.latestDiscovery.candidates.find((candidate)=>candidate.recordType==="candidate_region"&&candidate.status!=="rejected_reference_overlap");
  const candidateId=candidateRecord.id;
  const candidate=await fetch(`${base}/api/candidates/${encodeURIComponent(candidateId)}/evidence`).then((r)=>r.json());assert.equal(candidate.candidate.recordType,"candidate_region");if(candidate.candidate.sources?.climate?.normalizedDailyPath){const climate=await fetch(`${base}/api/candidates/${encodeURIComponent(candidateId)}/climate?offset=0&limit=40`).then((r)=>r.json());assert.ok(Object.keys(climate.history.daily??{}).length<=40);assert.ok(climate.nextOffset===null||climate.nextOffset>0);}assert.equal(candidate.candidate.id,candidateId);assert.ok(Object.hasOwn(candidate.candidate,"referenceMasking"));assert.equal(candidate.sources.terrain.status,candidateRecord.sources.terrain.status);assert.doesNotMatch(JSON.stringify(candidate),/[\u0600-\u06FF]/u);
  const discovery=await fetch(`${base}/api/discovery-runs/latest`).then((r)=>r.json());assert.equal(discovery.runId,summary.latestDiscoveryRunId);assert.doesNotMatch(JSON.stringify(discovery),/[\u0600-\u06FF]/u);
  if(candidate.candidate.spatialSupport?.gridRow!==undefined){assert.ok(candidate.candidate.cellBounds);assert.equal(candidate.candidate.missionId,summary.latestDiscovery.missionId);}
  const unsafe=await fetch(`${base}/api/references/%2e%2e%2fpackage.json`);assert.equal(unsafe.status,400);
  const invalidJob=await fetch(`${base}/api/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({missionId:"not-a-mission",studyAreaId:"not-a-config"})});assert.equal(invalidJob.status,400);
  const unsupportedMission=await fetch(`${base}/api/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({missionId:"geological_surface_exploration",studyAreaId:"atacama-climate-transect-v2"})});assert.equal(unsupportedMission.status,422);assert.equal((await unsupportedMission.json()).code,"UNSUPPORTED_MISSION_PROFILE");
  const tooLarge=await fetch(`${base}/api/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:" ".repeat(8200)});assert.equal(tooLarge.status,413);
  const discoveryRuns=await fetch(`${base}/api/discovery-runs`).then((r)=>r.json());assert.ok(discoveryRuns.runs.length>=1);const latestHistory=discoveryRuns.runs.find((run)=>run.runId===summary.latestDiscoveryRunId);assert.ok(latestHistory);assert.equal(latestHistory.targetBody,"Mars");assert.equal(latestHistory.studyAreaId,summary.latestDiscovery.studyArea.id);assert.equal(latestHistory.searchScope.kind,"bounded_grid");assert.equal(latestHistory.earthCandidateCount,summary.latestDiscovery.candidates.filter((candidate)=>candidate.status==="evidence_supported_for_review").length);assert.equal(latestHistory.outcome.reviewableCandidateCount,latestHistory.earthCandidateCount);assert.ok(Object.hasOwn(latestHistory.searchScope.bounds,"minLatitude"));assert.equal(latestHistory.missionName,profile.missions.find((mission)=>mission.id===latestHistory.missionId).name);
});

test("Mars target temperature context reads an actual stored candidate and keeps the source comparison ambiguous",async()=>{
  await waitForServer();
  const {runs}=await fetch(`${base}/api/discovery-runs`).then((response)=>response.json());
  assert.ok(Array.isArray(runs));
  let run, candidate, response;
  // The latest run may legitimately have insufficient evidence. Choose an
  // actual stored Mars run by explicit evidence criteria and pin the request
  // to that run instead of assuming whichever run is latest is comparable.
  for (const summary of runs.filter((item)=>item.targetBody==="Mars"&&item.status?.startsWith("completed")&&item.earthCandidateCount>0)) {
    const stored=await fetch(`${base}/api/discovery-runs/${encodeURIComponent(summary.runId)}`).then((item)=>item.ok?item.json():null);
    const eligible=stored?.candidates?.find((item)=>item.recordType==="candidate_region"&&item.status==="evidence_supported_for_review"&&item.sources?.climate?.status==="success"&&item.sources?.climate?.normalizedDailyPath);
    if(!eligible)continue;
    const query=new URLSearchParams({candidateId:eligible.id,runId:stored.runId});
    const candidateResponse=await fetch(`${base}/api/target-comparisons/mars-temperature?${query}`);
    if(candidateResponse.status===200){run=stored;candidate=eligible;response=candidateResponse;break;}
  }
  assert.ok(candidate,"a stored completed Mars run with a reviewable candidate and NASA POWER history is required");
  assert.equal(response.status,200);
  const context=await response.json();
  assert.equal(context.status,"ambiguous");
  assert.equal(context.candidate.source,"NASA POWER Daily Point API · T2M");
  assert.ok(context.candidate.statistics.count>0);
  assert.equal(context.target.product,"MSL-M-REMS-5-MODRDR-V1.0");
  assert.ok(context.target.solCount>0);
  assert.equal(Object.hasOwn(context,"difference"),false);
  assert.equal(/(?:^|\/)data\//.test(JSON.stringify(context)),false);
  const missing=await fetch(`${base}/api/target-comparisons/mars-temperature?candidateId=not-a-candidate&runId=${run.runId}`);
  assert.equal(missing.status,404);
  const invalid=await fetch(`${base}/api/target-comparisons/mars-temperature?candidateId=${encodeURIComponent(candidate.id)}`);
  assert.equal(invalid.status,400);
});

test("Mars target temperature context supports eligible Earth references and rejects region-only records",async()=>{
  await waitForServer();
  const response=await fetch(`${base}/api/target-comparisons/mars-temperature?referenceId=GKC`);
  assert.equal(response.status,200);
  const context=await response.json();
  assert.equal(context.status,"ambiguous");
  assert.deepEqual(context.earthRecord,{recordType:"known_analog",id:"GKC",label:"Gilf Kebir Crater Field"});
  assert.ok(context.candidate.statistics.count>0);
  assert.equal(Object.hasOwn(context,"difference"),false);
  const regionOnly=await fetch(`${base}/api/target-comparisons/mars-temperature?referenceId=DEV`);
  assert.equal(regionOnly.status,409);
  assert.equal((await regionOnly.json()).code,"REFERENCE_NOT_POINT_ELIGIBLE");
  const mixed=await fetch(`${base}/api/target-comparisons/mars-temperature?referenceId=GKC&candidateId=x&runId=12345678-1234-1234-1234-123456789012`);
  assert.equal(mixed.status,400);
});

test("candidate-to-candidate climate comparison uses two real reviewable records from stored runs",async()=>{
  const root=await mkdtemp(join(tmpdir(),"terramatch-candidate-pair-"));
  const probeServer=createServer();await new Promise((resolve)=>probeServer.listen(0,"127.0.0.1",resolve));const port=probeServer.address().port;await new Promise((resolve)=>probeServer.close(resolve));
  const runA="12345678-1234-4234-8234-123456789001",runB="12345678-1234-4234-8234-123456789002",candidateA="candidate-a",candidateB="candidate-b";
  const relative=(runId,id)=>`data/processed/climate/candidates/${runId}/${id}-daily.json`;
  const history=(id,values)=>({provider:"NASA POWER",locationId:id,parameters:["T2M","RH2M"],actualObservationPeriod:{start:"2001-01-01",end:"2001-01-02"},requestedCoordinate:{latitude:-23,longitude:-69},spatialResolution:"NASA POWER grid product",provenance:{sourceId:"nasa-power-daily",endpoint:"https://power.larc.nasa.gov/api/temporal/daily/point"},daily:values.map(([date,t,rh])=>({date,measurements:{T2M:{value:t,unit:"°C",qualityStatus:"valid"},RH2M:{value:rh,unit:"%",qualityStatus:"valid"}}}))});
  const candidate=(id,path)=>({id,recordType:"candidate_region",status:"evidence_supported_for_review",sources:{climate:{normalizedDailyPath:path}}});
  try{
    await mkdir(join(root,"data/processed"),{recursive:true});await mkdir(join(root,"data/mission-profiles"),{recursive:true});await writeFile(join(root,"data/processed/reference-sites.json"),"[]");await writeFile(join(root,"data/processed/candidate-points.json"),"[]");await writeFile(join(root,"data/mission-profiles/mars-surface-v1.json"),JSON.stringify({profileId:"fixture",profileVersion:"1.0.0",missions:[]}));
    for(const [runId,id,value] of [[runA,candidateA,10],[runB,candidateB,12]]){
      const historyPath=relative(runId,id);await mkdir(join(root,historyPath,".."),{recursive:true});await writeFile(join(root,historyPath),JSON.stringify(history(id,[["2001-01-01",value,40],["2001-01-02",value+1,41]])));
      await mkdir(join(root,"data/processed/discovery-runs"),{recursive:true});await writeFile(join(root,`data/processed/discovery-runs/${runId}.json`),JSON.stringify({runId,candidates:[candidate(id,historyPath)]}));
    }
    const server=spawn(process.execPath,["scripts/app-api.mjs"],{env:{...process.env,TERRAMATCH_DATA_DIR:root,PORT:String(port)},stdio:["ignore","ignore","pipe"]});let stderr="";server.stderr.on("data",(chunk)=>stderr+=chunk.toString());const origin=`http://127.0.0.1:${port}`;
    try{
      let ready=false;for(let attempt=0;attempt<50;attempt++){try{const response=await fetch(`${origin}/api/health`);if(response.ok){ready=true;break;}}catch{}await new Promise((resolve)=>setTimeout(resolve,100));}assert.ok(ready,`fixture API failed to start: ${stderr}`);
      const query=new URLSearchParams({candidateA,runA,candidateB,runB});const response=await fetch(`${origin}/api/candidate-comparisons/climate?${query}`);const responseText=await response.text();assert.equal(response.status,200,`${responseText} ${stderr}`);const result=JSON.parse(responseText);assert.equal(result.status,"descriptive");assert.equal(result.records.candidateA.candidateId,candidateA);assert.equal(result.records.candidateB.discoveryRunId,runB);assert.ok(result.factors.some((factor)=>factor.status==="compared"&&factor.pairedObservationCount===2&&factor.differenceBMinusA));assert.equal("score" in result,false);
      const duplicate=await fetch(`${origin}/api/candidate-comparisons/climate?${new URLSearchParams({candidateA,runA,candidateB:candidateA,runB:runA})}`);assert.equal(duplicate.status,400);
    }finally{const exited=new Promise((resolve)=>server.once("exit",resolve));server.kill();await exited;}
  }finally{await rm(root,{recursive:true,force:true});}
});
