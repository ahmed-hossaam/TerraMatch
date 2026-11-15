import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createComparisonRun, validateComparisonRun } from "../src/comparison/compare.js";
import { selectPointEligibleReferences } from "../src/evidence/unified.js";
import type { LocationRecord } from "../src/types/location.js";
const readJson=async(path:string)=>JSON.parse(await readFile(path,"utf8"));
const optionalJson=async(path:string)=>{try{await access(path);return await readJson(path);}catch{return null;}};
const discovery=await readJson(process.env.DISCOVERY_OUTPUT??"data/processed/discovery-runs/latest.json");
const allReferences=await readJson("data/processed/reference-sites.json") as LocationRecord[];
const curation=await readJson("data/curation/reference-curation-v1.json");
const references=selectPointEligibleReferences(allReferences,curation.records);
const knownHistory=await readJson("data/processed/climate/known-sites-daily.json");
const histories:Record<string,any>={};
for(const history of Array.isArray(knownHistory)?knownHistory:[knownHistory])if(history?.locationId){history.sourceFilePath="data/processed/climate/known-sites-daily.json";histories[history.locationId]=history;}
for(const id of ["DALL","DAL","AHS-GH"]){histories[id]=await optionalJson(`data/processed/supplementary-evidence/${id}-climate.json`);if(histories[id])histories[id].sourceFilePath=`data/processed/supplementary-evidence/${id}-climate.json`;}
const candidates:Record<string,any>={}, terrains:Record<string,any>={}, geologies:Record<string,any>={};
for(const candidate of discovery.candidates??[])if(candidate.recordType==="candidate_region"){const history=candidate.sources?.climate?.normalizedDailyPath?await optionalJson(candidate.sources.climate.normalizedDailyPath):null;if(history)history.sourceFilePath=candidate.sources.climate.normalizedDailyPath;candidates[candidate.id]=history;}
const terrainArray=await optionalJson("data/processed/terrain/elevation-samples.json")??[];
for(const terrain of terrainArray){terrain.sourceFilePath="data/processed/terrain/elevation-samples.json";terrains[terrain.locationId]=terrain;}
const geologyArray=await optionalJson("data/processed/geology/known-sites-glim.json")??[];
for(const geology of geologyArray){geology.sourceFilePath="data/processed/geology/known-sites-glim.json";geologies[geology.locationId]=geology;}
for(const id of ["DALL","DAL","AHS-GH"]) {terrains[id]=await optionalJson(`data/processed/supplementary-evidence/${id}-terrain.json`);geologies[id]=await optionalJson(`data/processed/supplementary-evidence/${id}-geology.json`);if(terrains[id])terrains[id].sourceFilePath=`data/processed/supplementary-evidence/${id}-terrain.json`;if(geologies[id])geologies[id].sourceFilePath=`data/processed/supplementary-evidence/${id}-geology.json`;}
const excludedReferenceIds=allReferences.filter((record:any)=>!references.some((eligible:any)=>eligible.id===record.id)).map((record:any)=>record.id);
const run=createComparisonRun({discoveryRun:discovery,references,candidateHistories:candidates,referenceHistories:histories,referenceTerrains:terrains,referenceGeologies:geologies,referenceSelection:{policyId:"reference-curation-v1-point-eligibility",policyVersion:"1.0.0",archiveRecordCount:allReferences.length,excludedReferenceIds}});
const errors=validateComparisonRun(run);if(errors.length)throw new Error(`Comparison output invalid: ${errors.join("; ")}`);
const dir=process.env.COMPARISON_ARCHIVE_DIRECTORY??"data/processed/comparison-runs";await mkdir(dir,{recursive:true});
const archive=`${dir}/${run.runId}.json`,latest=process.env.COMPARISON_LATEST_OUTPUT??"data/processed/comparison-runs/latest.json",report=process.env.COMPARISON_VALIDATION_OUTPUT??"data/processed/comparison-runs/validation-report.json";
const atomic=async(path:string,value:unknown)=>{const temp=`${path}.${process.pid??"p"}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`,"utf8");await rename(temp,path);};
try{await access(archive);throw new Error(`Comparison archive already exists and will not be overwritten: ${archive}`);}catch(error){if(error instanceof Error&&error.message.includes("will not be overwritten"))throw error;}
await atomic(archive,run);await atomic(latest,run);
const factorStatusCounts=Object.fromEntries(["compared","ambiguous","unavailable","failed","missing"].map(status=>[status,run.comparisons.reduce((n:any,p:any)=>n+p.factors.filter((f:any)=>f.status===status).length,0)]));
const validation={schemaVersion:"1.0.0",generatedAt:new Date().toISOString(),status:"valid",runId:run.runId,configurationId:run.configurationId,candidateCount:run.candidateCount,referenceCount:run.referenceDataset.count,comparisonPairCount:run.comparisonPairCount,factorStatusCounts,errors:[]};
await atomic(report,validation);
console.log(JSON.stringify({...validation,archivePath:archive,latestPath:latest,candidateIds:[...new Set(run.comparisons.map((p:any)=>p.candidateId))]},null,2));
