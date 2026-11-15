import { readFile, mkdir, writeFile, rename, access } from "node:fs/promises";
import { validateRecords } from "../src/validation/records.js";

const json=async(path:string)=>JSON.parse(await readFile(path,"utf8"));
const atlas=await json("data/processed/known-sites.json");
const additions=await json("data/processed/supplementary-known-sites.json");
const review=await json("data/benchmarks/supplementary-site-review.json");
const combined=await json("data/processed/reference-sites.json");
const retrieval=await json("data/processed/supplementary-evidence/retrieval-report.json");
const errors:string[]=[...validateRecords(atlas).map((e:any)=>`original atlas ${e.id}: ${e.message}`),...validateRecords(additions).map((e:any)=>`supplement ${e.id}: ${e.message}`),...validateRecords(combined).map((e:any)=>`combined ${e.id}: ${e.message}`)];
const allowedDecisions=new Set(["accepted_region_sample","accepted_specific_sampling_area","accepted_region_only","accepted_specific_spring_system"]);
for(const item of review.sites??[]) {
  if(!allowedDecisions.has(item.decision))errors.push(`${item.id}: unrecognized or non-accepted curation status`);
  if(!Array.isArray(item.sources)||item.sources.length===0||item.sources.some((s:any)=>!s.citation||!/^https:\/\//.test(s.url)))errors.push(`${item.id}: publication citation and URL are required`);
  if((item.latitude===null)!==(item.longitude===null))errors.push(`${item.id}: region point coordinates must both be null`);
  if(item.latitude!==null&&(!Number.isFinite(item.latitude)||item.latitude < -90||item.latitude > 90||!Number.isFinite(item.longitude)||item.longitude < -180||item.longitude > 180||item.coordinatesApproximate!==true))errors.push(`${item.id}: coordinates must be valid and approximate status explicit`);
  if(!item.granularity||!item.identityEvidence||!Array.isArray(item.limitations)||!item.mineralEvidence)errors.push(`${item.id}: identity, granularity, limitations, and mineral evidence status must be documented`);
}
for(const record of additions) {
  if(record.recordType!=="known_analog")errors.push(`${record.id}: supplementary accepted record must be known_analog`);
  if(record.geology.minerals.length!==0)errors.push(`${record.id}: no unreviewed mineral claims may be promoted`);
  if(record.provenance.length===0||!record.provenance.every((p:any)=>p.sourceId&&p.provider&&p.processingMethod&&p.spatialResolution))errors.push(`${record.id}: provenance is incomplete`);
  if(record.latitude===null&&record.longitude===null&&record.coordinatesApproximate!==null)errors.push(`${record.id}: region-only coordinate status should be null`);
}
if(atlas.length!==26)errors.push(`expected preserved original reference count 26, got ${atlas.length}`);
if(additions.length!==review.sites.length)errors.push("supplementary normalized record count differs from review manifest");
if(combined.length!==atlas.length+additions.length)errors.push("combined reference set count mismatch");

const providerSiteSummaries:any[]=[];
for(const site of retrieval.results??[]) {
  const record=additions.find((r:any)=>r.id===site.siteId);
  const files:any={};
  for(const key of ["climate","terrain","geology"]) {
    const source=site.evidence?.[key]; if(!source)continue;
    files[key]={status:source.status,rawPresent:false,normalizedPresent:false};
    if(source.rawPath){try{await access(source.rawPath);files[key].rawPresent=true;}catch{errors.push(`${site.siteId}: source reports raw ${key} path but file is absent`);}}
    if(source.normalizedPath){try{await access(source.normalizedPath);files[key].normalizedPresent=true;const normalized=await json(source.normalizedPath);if(record){if(normalized.locationId!==site.siteId)errors.push(`${site.siteId}: normalized ${key} result has a mismatched site ID`);if(normalized.coordinatesApproximate!==record.coordinatesApproximate)errors.push(`${site.siteId}: normalized ${key} result has mismatched coordinate uncertainty`);if(normalized.requestedCoordinate?.latitude!==record.latitude||normalized.requestedCoordinate?.longitude!==record.longitude)errors.push(`${site.siteId}: normalized ${key} result has mismatched requested coordinates`);if(key==="terrain"&&normalized.elevationSampleM?.value!==record.elevationSampleM?.value)errors.push(`${site.siteId}: point elevation does not match normalized reference measurement`);if(key==="geology"&&normalized.lithologyEvidence?.status==="mapped"&&normalized.lithologyEvidence.features.length===1&&normalized.lithologyEvidence.features[0].litho!==record.geology.lithology.classification)errors.push(`${site.siteId}: GLiM source code does not match normalized reference record`);}}catch{errors.push(`${site.siteId}: source reports normalized ${key} path but file is missing or invalid JSON`);}}
    if(source.status==="success"&&!files[key].normalizedPresent)errors.push(`${site.siteId}: successful ${key} retrieval has no normalized file`);
  }
  if(record&&site.status==="attempted") {
    const climate=site.evidence?.climate?.status==="success";
    const terrain=site.evidence?.terrain?.status==="success";
    const geology=site.evidence?.geology?.status==="success";
    if(climate&&Object.values(record.climate).filter((v:any)=>v&&typeof v==="object"&&"value" in v).some((v:any)=>v.value!==null&&v.qualityStatus!=="needs_verification"))errors.push(`${site.siteId}: climate value quality/provenance state is inconsistent`);
    if(terrain&&record.terrain.sourceId!=="copernicus-dem-glo-30")errors.push(`${site.siteId}: DEM provenance was not linked to normalized reference record`);
    if(geology&&record.geology.lithology.sourceId!=="glim-v1.1-level-i")errors.push(`${site.siteId}: GLiM provenance was not linked to normalized reference record`);
    providerSiteSummaries.push({siteId:site.siteId,status:site.status,climateStatus:site.evidence?.climate?.status??"not_attempted",terrainStatus:site.evidence?.terrain?.status??"not_attempted",geologyStatus:site.evidence?.geology?.status??"not_attempted",climateCoverage:record.climate.coverage,glimClassification:record.geology.lithology.classification,files});
  }
}
const providerStatuses=(retrieval.results??[]).flatMap((site:any)=>Object.values(site.evidence??{}) as any[]);
const report={schemaVersion:"1.0.0",generatedAt:new Date().toISOString(),status:errors.length?"invalid":"valid",originalAtlasCount:atlas.length,acceptedSupplementaryCount:additions.length,pendingCount:review.sites.filter((s:any)=>s.decision.startsWith("pending")).length,rejectedCount:review.sites.filter((s:any)=>s.decision.startsWith("rejected")).length,finalReferenceCount:combined.length,pointRetrievalEligibleIds:additions.filter((r:any)=>r.latitude!==null&&r.longitude!==null).map((r:any)=>r.id),regionLevelIds:additions.filter((r:any)=>r.latitude===null||r.longitude===null).map((r:any)=>r.id),supplementaryProviderAttempts:retrieval.providerAttemptCount,supplementaryProviderSuccesses:providerStatuses.filter((s:any)=>s.status==="success").length,supplementaryProviderFailures:providerStatuses.filter((s:any)=>s.status==="failed").length,siteEvidence:providerSiteSummaries,candidateFixtureCount:3,fixtureClassification:"test_fixture records remain separate in candidate-points.json",errors};
const path=process.env.REFERENCE_VALIDATION_OUTPUT??"data/processed/reference-sites-validation-report.json";await mkdir(path.slice(0,Math.max(path.lastIndexOf("/"),path.lastIndexOf("\\"))),{recursive:true});const tmp=`${path}.${process.pid??"p"}.tmp`;await writeFile(tmp,`${JSON.stringify(report,null,2)}\n`,"utf8");await rename(tmp,path);console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
