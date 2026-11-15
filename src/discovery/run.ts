import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { LocationRecord } from "../types/location.js";
import type { MissionProfile } from "../types/mission-profile.js";
import { validateMissionProfile } from "../schemas/mission-profile.js";
import { excludeReferenceOverlap, generateGrid, type StudyArea } from "./grid.js";
import { screenCandidate, type FactorEvidence } from "./screen.js";
import { retrievePointEvidence, type PointEvidenceOptions } from "./point-evidence.js";

export interface DiscoveryRunInput { studyArea:StudyArea; studyAreaConfigurationStatus?:string; studyAreaLimitations?:string[]; missionProfile:MissionProfile; missionId:string; references:LocationRecord[]; retrieve?:(record:LocationRecord)=>Promise<Record<string,any>>; retrievalOptions?:PointEvidenceOptions; }
export interface DiscoveryCandidateResult { id:string; recordType:"candidate_region"; planet:"Earth"; latitude:number; longitude:number; coordinatesApproximate:true; spatialSupport:{studyAreaId:string;gridRow:number;gridColumn:number;cellSpacingDegrees:number;referenceExclusionKm:number}; status:"evidence_supported_for_review"|"insufficient_evidence"|"rejected_reference_overlap"; screening:ReturnType<typeof screenCandidate>; evidence:FactorEvidence[]; sources:Record<string,unknown>; limitations:string[]; }
export interface DiscoveryRun { schemaVersion:"1.0.0"; runId:string; configurationId:string; createdAt:string; status:"completed"|"completed_with_errors"; missionProfileId:string; missionProfileVersion:string; missionId:string; studyArea:StudyArea; studyAreaConfigurationStatus:string; studyAreaLimitations:string[]; generatedCellCount:number; excludedReferenceOverlapCount:number; referenceMasking:{rule:string;pointReferenceIdsUsed:string[];unmaskedRegionReferenceIds:string[];invalidCoordinateReferenceIds:string[]}; candidates:DiscoveryCandidateResult[]; limitations:string[]; }

const compactResults=(bundle:Record<string,any>)=>{
  const output:Record<string,unknown>={};
  for(const [key,result] of Object.entries(bundle)) {
    if(result?.status!=="success"){output[key]={status:result?.status??"not_requested",provider:result?.provider??null,endpoint:result?.endpoint??null,sourceUrl:result?.sourceUrl??null,requestedCoordinate:result?.requestedCoordinate??null,retrievalAttemptedAt:result?.retrievalAttemptedAt??null,error:result?.error??null,rawPath:result?.rawPath??null,expectedRawPath:result?.expectedRawPath??null};continue;}
    if(key==="climate") output[key]={status:"success",provider:result.normalized.provider,requestedPeriod:result.normalized.requestedPeriod,actualObservationPeriod:result.normalized.actualObservationPeriod,parameters:result.normalized.parameters,coverage:Object.fromEntries(Object.entries(result.normalized.summaries).map(([id,s]:any)=>[id,{validObservationCount:s.validObservationCount,missingObservationCount:s.missingObservationCount,coveragePercent:s.coveragePercent,unit:s.unit}])),rawPath:result.rawPath,metadataPath:result.metadataPath,normalizedDailyPath:result.normalizedDailyPath??null,cacheHit:result.cacheHit,normalizationPersistence:result.normalizationPersistence??{status:"not_attempted"},provenance:result.normalized.provenance};
    else if(key==="terrain") output[key]={status:"success",elevation:result.normalized.elevationSampleM,productId:result.normalized.productId,productVersion:result.normalized.productVersion,tileId:result.normalized.tileId,sourceUrl:result.normalized.sourceUrl,horizontalCrs:result.normalized.horizontalCrs,verticalDatum:result.normalized.verticalDatum,spatialResolutionNominalM:result.normalized.spatialResolutionNominalM,sampleCoordinate:result.normalized.providerResponseCoordinate,retrievedAt:result.normalized.retrievedAt,provenance:result.normalized.provenance,limitations:result.normalized.limitations,rawPath:result.rawPath};
    else output[key]={status:"success",classificationStatus:result.normalized.lithologyEvidence.status,features:result.normalized.lithologyEvidence.features,provenance:result.normalized.provenance,warnings:result.normalized.warnings,rawPath:result.rawPath};
  }
  return output;
};
function factorEvidence(bundle:Record<string,any>):FactorEvidence[] {
  const climate=bundle.climate?.status==="success"?bundle.climate.normalized:null;
  const terrain=bundle.terrain?.status==="success"?bundle.terrain.normalized:null;
  const geology=bundle.geology?.status==="success"?bundle.geology.normalized:null;
  const climateFactor=(factorId:string,params:string[])=>{
    const summaries=params.map(p=>climate?.summaries?.[p]);
    const count=summaries.reduce((n,s:any)=>n+(s?.validObservationCount??0),0);
    const ok=!!climate&&summaries.every((s:any)=>s&&s.validObservationCount>0);
    const status=ok&&!bundle.climate?.persistenceError?"available":bundle.climate?.persistenceError||bundle.climate?.status==="failed"?"failed":"missing";
    return {factorId,status,value:Object.fromEntries(params.map((p,i)=>[p,summaries[i]?.mean??null])),unit:summaries.map((s:any)=>s?.unit).filter(Boolean).join(", ")||null,sourceId:ok?"nasa-power-daily-point":null,provenancePath:bundle.climate?.rawPath??null,note:bundle.climate?.persistenceError?`Normalized climate persistence failed: ${bundle.climate.persistenceError}`:ok?`${count} valid parameter observations; daily summaries come from NASA POWER gridded product.`:bundle.climate?.error??"No valid observations for required climate parameters."} as FactorEvidence;
  };
  const rangeAvailable=!!climate?.daily?.some((day:any)=>day.temperatureRangeC?.value!==null&&day.temperatureRangeC?.value!==undefined);
  const mapped=geology?.lithologyEvidence?.status==="mapped";
  const ambiguous=geology?.lithologyEvidence?.status==="ambiguous";
  return [
    climateFactor("air_temperature_daily_mean",["T2M"]),
    climateFactor("air_temperature_extremes",["T2M_MAX","T2M_MIN"]),
    {factorId:"daily_temperature_range",status:rangeAvailable&&!bundle.climate?.persistenceError?"available":bundle.climate?.persistenceError||bundle.climate?.status==="failed"?"failed":"missing",value:rangeAvailable?"daily T2M_MAX - T2M_MIN values present":null,unit:"°C",sourceId:rangeAvailable?"nasa-power-daily-point":null,provenancePath:bundle.climate?.rawPath??null,note:bundle.climate?.persistenceError?`Normalized climate persistence failed: ${bundle.climate.persistenceError}`:rangeAvailable?"Derived per day only when both extrema are valid.":bundle.climate?.error??"No valid daily ranges."},
    climateFactor("relative_humidity",["RH2M"]),climateFactor("precipitation",["PRECTOTCORR"]),climateFactor("wind_speed",["WS10M"]),climateFactor("solar_radiation",["ALLSKY_SFC_SW_DWN"]),
    {factorId:"mapped_lithology",status:mapped?"available":ambiguous?"ambiguous":bundle.geology?.status==="failed"?"failed":"missing",value:mapped?geology.lithologyEvidence.features.map((f:any)=>f.originalAttributes):ambiguous?geology.lithologyEvidence.features.map((f:any)=>f.originalAttributes):null,unit:"GLiM source categories",sourceId:mapped||ambiguous?"glim-v1.1-level-i":null,provenancePath:bundle.geology?.rawPath??null,note:mapped?"One generalized mapped polygon; not field verification or mineralogy.":ambiguous?"Multiple intersecting GLiM polygons; all categories retained and treated as ambiguous.":bundle.geology?.error??"No mapped GLiM classification returned."},
    {factorId:"mineral_evidence",status:"missing",value:null,unit:null,sourceId:null,provenancePath:null,note:"Mineral evidence is not provided by GLiM and is not inferred from lithology."},
    {factorId:"elevation_point",status:terrain?.elevationSampleM?.value!==null&&terrain?.elevationSampleM?.value!==undefined?"available":bundle.terrain?.status==="failed"?"failed":"missing",value:terrain?.elevationSampleM?.value??null,unit:terrain?.elevationSampleM?.unit??"m",sourceId:terrain?"copernicus-dem-glo-30":null,provenancePath:bundle.terrain?.rawPath??null,note:terrain?"Single Copernicus GLO-30 DSM pixel; not slope or terrain suitability.":bundle.terrain?.error??"No valid elevation sample."},
    ...["slope_roughness_relief","surface_material_class","sediment_regolith_properties","hydrological_context","terrestrial_surface_pressure","uv_radiation","dust_aerosol","aridity_water_balance","geological_process_evidence"].map(factorId=>({factorId,status:"missing" as const,value:null,unit:null,sourceId:null,provenancePath:null,note:factorId==="geological_process_evidence"?"Legacy regional narrative is not treated as newly retrieved, location-specific geological-process evidence.":"This factor is not supplied by the currently enabled point integrations."}))
  ];
}
function makeCandidateRecord(point:{candidateId:string;latitude:number;longitude:number;row:number;column:number;cellSpacingDegrees:number}):LocationRecord {
  const missing=(unit:string)=>({value:null,unit,sourceId:"discovery-pending",qualityStatus:"missing" as const,processingMethod:"Not retrieved or not applicable; null preserved",observationPeriod:null});
  return {id:point.candidateId,recordType:"candidate_region",planet:"Earth",latitude:point.latitude,longitude:point.longitude,coordinatesApproximate:true,country:null,regionName:null,discoveryMethod:"Reference-guided bounded grid cell; not a confirmed Mars analog",elevationMeanM:missing("m"),elevationSampleM:missing("m"),climate:{observationPeriod:null,meanTemperatureC:missing("°C"),meanDailyTemperatureRangeC:missing("°C"),meanHumidityPct:missing("%"),annualPrecipitationMm:missing("mm/year"),meanWindSpeedMs:missing("m/s"),meanSolarRadiation:missing("MJ/m²/day"),missingDays:null,validDays:null,coverage:null},terrain:{elevationMinM:missing("m"),elevationMaxM:missing("m"),slopeMeanDeg:missing("degrees"),slopeP95Deg:missing("degrees"),roughness:missing("not calculated"),rasterResolutionM:null,sourceId:null,qualityStatus:"missing"},geology:{lithology:{classification:null,sourceId:"discovery-pending",qualityStatus:"missing"},minerals:[],formationDescription:null,rockDescription:null,references:[],evidenceQuality:"missing"},dataQuality:{coverage:null,confidence:null,missingFactors:[],warnings:["Generated cell center represents a grid cell, not an exact sampled field point."],validationErrors:[],qualityNotes:[]},provenance:[],atlas:null};
}
export async function runDiscovery(input:DiscoveryRunInput):Promise<DiscoveryRun> {
  const profileErrors=validateMissionProfile(input.missionProfile); if(profileErrors.length) throw new Error(`Mission profile invalid: ${profileErrors.join("; ")}`);
  const mission=input.missionProfile.missions.find(m=>m.id===input.missionId); if(!mission) throw new Error(`Unknown mission id ${input.missionId}`);
  const points=generateGrid(input.studyArea); const partition=excludeReferenceOverlap(points,input.references,input.studyArea.referenceExclusionKm); const excludedById=new Map(partition.excluded.map(e=>[e.point.candidateId,e]));
  const candidates:DiscoveryCandidateResult[]=[];
  for(const point of points) {
    const record=makeCandidateRecord(point); const exclusion=excludedById.get(point.candidateId);
    let bundle:Record<string,any>={};
    if(!exclusion) {
      try { bundle=await (input.retrieve??(r=>retrievePointEvidence(r,input.retrievalOptions)))(record); }
      catch(error) { bundle={pipeline:{status:"failed",error:error instanceof Error?error.message:String(error)}}; }
      try { await saveCandidateClimate(bundle, point.candidateId); if(bundle.climate?.status==="success")bundle.climate.normalizationPersistence={status:"saved"}; }
      catch(error) { if(bundle.climate?.status==="success"){bundle.climate.persistenceError=error instanceof Error?error.message:String(error);bundle.climate.normalizationPersistence={status:"failed",error:bundle.climate.persistenceError};} }
    }
    const factors=factorEvidence(bundle);
    const screening=screenCandidate(input.missionProfile,mission,factors,exclusion?{referenceId:exclusion.nearestReferenceId,distanceKm:exclusion.distanceKm,edgeDistanceKm:exclusion.edgeDistanceKm,cellHalfDiagonalKm:exclusion.cellHalfDiagonalKm,radiusKm:input.studyArea.referenceExclusionKm}:undefined);
    const sources=compactResults(bundle);
    candidates.push({id:point.candidateId,recordType:"candidate_region",planet:"Earth",latitude:point.latitude,longitude:point.longitude,coordinatesApproximate:true,spatialSupport:{studyAreaId:input.studyArea.id,gridRow:point.row,gridColumn:point.column,cellSpacingDegrees:point.cellSpacingDegrees,referenceExclusionKm:input.studyArea.referenceExclusionKm},status:screening.status,screening,evidence:factors,sources,limitations:["A grid candidate is a screening location, not a confirmed analog.","Mission result assesses required evidence presence only; no numerical thresholds or comparison scores are used.","Point products are sampled at approximate grid-cell centers and have source-specific spatial support."]});
  }
  const signature=JSON.stringify({area:input.studyArea,profile:input.missionProfile.profileId,version:input.missionProfile.profileVersion,mission:input.missionId,ids:candidates.map(c=>c.id)});
  const configurationId=createHash("sha256").update(signature).digest("hex").slice(0,16);
  const persistenceErrors=candidates.flatMap(candidate=>candidate.sources.climate&&((candidate.sources.climate as any).normalizationPersistence?.status==="failed")?[`Climate normalization persistence failed for ${candidate.id}`]:[]);
  return {schemaVersion:"1.0.0",runId:randomUUID(),configurationId,createdAt:new Date().toISOString(),status:persistenceErrors.length?"completed_with_errors":"completed",missionProfileId:input.missionProfile.profileId,missionProfileVersion:input.missionProfile.profileVersion,missionId:input.missionId,studyArea:input.studyArea,studyAreaConfigurationStatus:input.studyAreaConfigurationStatus??"user_configured",studyAreaLimitations:input.studyAreaLimitations??[],generatedCellCount:points.length,excludedReferenceOverlapCount:partition.excluded.length,referenceMasking:{rule:"Reference point within configured distance after conservative grid-cell half-diagonal expansion; coordinate-free references are unmasked.",pointReferenceIdsUsed:input.references.filter(r=>r.recordType==="known_analog"&&r.latitude!==null&&r.longitude!==null&&Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)&&r.latitude>=-90&&r.latitude<=90&&r.longitude>=-180&&r.longitude<=180).map(r=>r.id),unmaskedRegionReferenceIds:partition.unmaskedRegionReferenceIds,invalidCoordinateReferenceIds:partition.invalidReferenceIds},candidates,limitations:["Bounded configured study area only; no global coverage.","Reference masking uses point coordinates; region-level references without coordinates are explicitly unmasked.","Evidence presence is not similarity, mission suitability, or scientific confirmation.","NASA POWER is gridded; Copernicus GLO-30 is a DSM; GLiM is a generalized map; approximate cell coordinates add uncertainty.",...persistenceErrors]};
}
export function validateDiscoveryRun(value:unknown):string[] {
  const errors:string[]=[]; if(!value||typeof value!=="object"||Array.isArray(value))return ["run must be an object"];
  const run=value as any; if(run.schemaVersion!=="1.0.0"||!["completed","completed_with_errors"].includes(run.status)||!Array.isArray(run.candidates)||typeof run.runId!=="string"||typeof run.configurationId!=="string")errors.push("run schema/status/identity/candidates are invalid");
  if(run.studyArea?.boundingBox){const b=run.studyArea.boundingBox;for(const c of run.candidates??[])if(c.latitude<b.minLatitude-1e-9||c.latitude>b.maxLatitude+1e-9||c.longitude<b.minLongitude-1e-9||c.longitude>b.maxLongitude+1e-9)errors.push(`candidate ${c.id} is outside study area`);}
  const ids=new Set<string>();
  for(const [index,c] of (run.candidates??[]).entries()) { if(c.recordType!=="candidate_region")errors.push(`candidates[${index}] must be candidate_region`); if(typeof c.id!=="string"||ids.has(c.id))errors.push(`duplicate or invalid candidate id ${c.id}`); ids.add(c.id); if(!Number.isFinite(c.latitude)||c.latitude < -90||c.latitude>90||!Number.isFinite(c.longitude)||c.longitude < -180||c.longitude>180)errors.push(`candidate ${c.id} has invalid coordinate`); if(!["evidence_supported_for_review","insufficient_evidence","rejected_reference_overlap"].includes(c.status))errors.push(`candidate ${c.id} has invalid status`); if(!Array.isArray(c.evidence)||!c.screening?.requiredFactors)errors.push(`candidate ${c.id} lacks screening evidence`); for(const source of Object.values(c.sources??{}) as any[])if(!["success","failed","not_requested"].includes(source.status))errors.push(`candidate ${c.id} has inconsistent provider status`); if(c.status!==c.screening?.status)errors.push(`candidate ${c.id} status differs from screening status`); const expectedMissing=(c.screening?.requiredFactors??[]).filter((f:any)=>f.status!=="available").map((f:any)=>f.factorId).sort(); if(JSON.stringify(expectedMissing)!==JSON.stringify([...(c.screening?.missingFactors??[])].sort()))errors.push(`candidate ${c.id} missing factors disagree with required evidence states`); if(c.sources?.climate?.normalizationPersistence?.status==="failed"&&c.status==="evidence_supported_for_review")errors.push(`candidate ${c.id} claims supported evidence despite failed climate persistence`); }
  if(/"(?:score|scores|rank|ranking|weight|weights|similarity|confidence)"\s*:/i.test(JSON.stringify(value)))errors.push("discovery result must not contain score, ranking, weight, similarity, or confidence outputs");
  return errors;
}
export async function persistDiscoveryRun(run:DiscoveryRun,path="data/processed/discovery-runs/latest.json") {
  const errors=validateDiscoveryRun(run); if(errors.length)throw new Error(`Invalid discovery output: ${errors.join("; ")}`);
  await mkdir(path.slice(0,Math.max(path.lastIndexOf("/"),path.lastIndexOf("\\"))),{recursive:true}); const temp=`${path}.${process.pid??"p"}.tmp`; await writeFile(temp,`${JSON.stringify(run,null,2)}\n`,"utf8"); await rename(temp,path);
}
export async function persistDiscoveryArchive(run:DiscoveryRun,directory="data/processed/discovery-runs") {
  const errors=validateDiscoveryRun(run);if(errors.length)throw new Error(`Invalid discovery archive: ${errors.join("; ")}`);
  await mkdir(directory,{recursive:true});const path=`${directory}/${run.runId}.json`;const temp=`${path}.${process.pid??"p"}.tmp`;
  try { await access(path); throw new Error(`Discovery archive already exists and will not be overwritten: ${path}`); } catch(error) { if(error instanceof Error&&error.message.includes("will not be overwritten"))throw error; }
  await writeFile(temp,`${JSON.stringify(run,null,2)}\n`,{encoding:"utf8",flag:"wx"});await rename(temp,path);return path;
}
export async function saveCandidateClimate(result:any, candidateId:string) {
  if(result.climate?.status!=="success")return;
  const path=`data/processed/climate/candidates/${candidateId}-daily.json`; await mkdir("data/processed/climate/candidates",{recursive:true}); const tmp=`${path}.${process.pid??"p"}.tmp`; await writeFile(tmp,`${JSON.stringify(result.climate.normalized,null,2)}\n`,"utf8"); await rename(tmp,path); result.climate.normalizedDailyPath=path;
}
export async function loadJson(path:string):Promise<any>{return JSON.parse(await readFile(path,"utf8"));}
