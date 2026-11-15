import { readFile, mkdir, writeFile, rename, access } from "node:fs/promises";
import type { LocationRecord } from "../src/types/location.js";
import { validateRecords } from "../src/validation/records.js";
import { retrievePointEvidence } from "../src/discovery/point-evidence.js";
import { applySupplementaryEvidence } from "../src/normalization/supplementary-evidence.js";

const records=JSON.parse(await readFile("data/processed/supplementary-known-sites.json","utf8")) as LocationRecord[];
const selected=(process.env.SUPPLEMENTARY_SITE_IDS??records.filter(r=>r.latitude!==null&&r.longitude!==null).map(r=>r.id).join(",")).split(",").map(s=>s.trim()).filter(Boolean);
const results:any[]=[]; const normalizedById=new Map<string,Record<string,any>>();
await mkdir("data/processed/supplementary-evidence",{recursive:true});
async function atomic(path:string,value:unknown){const temp=`${path}.${process.pid??"p"}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`,"utf8");await rename(temp,path);}
async function readIfPresent(path:string){try{await access(path);return JSON.parse(await readFile(path,"utf8"));}catch{return undefined;}}

for(const id of selected){
  const record=records.find(r=>r.id===id);
  if(!record){results.push({siteId:id,status:"failed",error:"supplement not found"});continue;}
  if(record.latitude===null||record.longitude===null){results.push({siteId:id,status:"region_level_point_retrieval_unavailable",rawSourceRequests:0});continue;}
  const retrieved=await retrievePointEvidence(record,{timeoutMs:Number(process.env.DISCOVERY_TIMEOUT_MS??20000)});
  const normalized:Record<string,any>={}; const normalizedPaths:Record<string,string|null>={};
  for(const [key,value] of Object.entries(retrieved) as Array<[string,any]>){
    const path=`data/processed/supplementary-evidence/${id}-${key}.json`;
    if(value.status==="success") { await atomic(path,value.normalized); normalized[key]=value.normalized; normalizedPaths[key]=path; }
    else { const existing=await readIfPresent(path); if(existing)normalized[key]=existing; normalizedPaths[key]=existing?path:null; }
  }
  normalizedById.set(id,normalized);
  await atomic(`data/processed/supplementary-evidence/${id}.json`,{schemaVersion:"1.0.0",recordType:"supplementary-point-evidence",siteId:id,requestedCoordinate:{latitude:record.latitude,longitude:record.longitude},coordinatesApproximate:record.coordinatesApproximate,providerStatuses:Object.fromEntries(Object.entries(retrieved).map(([key,value]:any)=>[key,value.status])),normalizedPaths,limitations:record.dataQuality.warnings});
  results.push({siteId:id,status:"attempted",coordinatesApproximate:record.coordinatesApproximate,evidence:Object.fromEntries(Object.entries(retrieved).map(([key,value]:any)=>[key,{status:value.status,error:value.error??null,rawPath:value.rawPath??null,expectedRawPath:value.expectedRawPath??null,normalizedPath:normalizedPaths[key]??null,sourceId:value.normalized?.provenance?.sourceId??value.normalized?.provenance?.provider??null}]))});
}

const updated=records.map(record=>normalizedById.has(record.id)?applySupplementaryEvidence(record,normalizedById.get(record.id)!):record);
const base=JSON.parse(await readFile("data/processed/known-sites.json","utf8")) as LocationRecord[];
const errors=[...validateRecords(updated),...validateRecords([...base,...updated])];
if(errors.length)throw new Error(`Supplementary normalized output failed validation: ${JSON.stringify(errors)}`);
await atomic("data/processed/supplementary-known-sites.json",updated);
await atomic("data/processed/reference-sites.json",[...base,...updated]);
const providerStatuses=results.flatMap(site=>Object.values(site.evidence??{}) as any[]);
const report={schemaVersion:"1.0.0",generatedAt:new Date().toISOString(),requestedSiteIds:selected,pointSiteCount:results.filter(site=>site.status==="attempted").length,regionLevelSkippedCount:results.filter(site=>site.status==="region_level_point_retrieval_unavailable").length,providerAttemptCount:providerStatuses.length,providerSuccessCount:providerStatuses.filter(status=>status.status==="success").length,providerFailureCount:providerStatuses.filter(status=>status.status==="failed").length,results};
await atomic("data/processed/supplementary-evidence/retrieval-report.json",report); console.log(JSON.stringify(report,null,2));
