import { readFile } from "node:fs/promises";
import { describe,it } from "node:test";
import assert from "node:assert/strict";
import type { MissionProfile } from "../src/types/mission-profile.js";
import type { LocationRecord } from "../src/types/location.js";
import { generateGrid, validateStudyArea, excludeReferenceOverlap, type StudyArea } from "../src/discovery/grid.js";
import { runDiscovery, validateDiscoveryRun } from "../src/discovery/run.js";
import { screenCandidate, type FactorEvidence } from "../src/discovery/screen.js";
const json=async(path:string)=>JSON.parse(await readFile(path,"utf8"));
const area:StudyArea={id:"unit-test",label:"unit test",boundingBox:{minLatitude:10,minLongitude:20,maxLatitude:10.4,maxLongitude:20.4},spacingDegrees:0.2,maxCandidates:10,referenceExclusionKm:5};
const minimalRef={id:"known",recordType:"known_analog",latitude:10.1,longitude:20.1} as LocationRecord;

describe("bounded reference-guided candidate discovery",()=>{
  it("keeps the versioned Atacama demonstration bounded and deterministic",async()=>{
    const config=await json("data/discovery/study-areas/atacama-climate-transect-v2.json");const points=generateGrid(config.studyArea);
    assert.equal(config.configurationStatus,"bounded_demonstration_configuration_not_a_scientific_discovery");assert.equal(points.length,4);assert.equal(points.length,config.studyArea.maxCandidates);assert.equal(config.providerRequestLimit,12);assert.match(config.demonstrationRationale,/does not establish analog validity/);
    const references=await json("data/processed/reference-sites.json");const masked=excludeReferenceOverlap(points,references,config.studyArea.referenceExclusionKm);assert.ok(masked.retained.length>0);assert.deepEqual(masked.unmaskedRegionReferenceIds.sort(),["LUT","SEM"]);
  });
  it("generates deterministic cell centers within bounds and honors the cap",()=>{
    const first=generateGrid(area),second=generateGrid(area);
    assert.deepEqual(first,second); assert.equal(first.length,4);
    assert.equal(first.every(p=>p.latitude>=10&&p.latitude<=10.4&&p.longitude>=20&&p.longitude<=20.4),true);
    assert.equal(generateGrid({...area,maxCandidates:2}).length,2);
    const partial=generateGrid({...area,boundingBox:{minLatitude:10,minLongitude:20,maxLatitude:10.5,maxLongitude:20.5},spacingDegrees:0.2});
    assert.equal(partial.at(-1)?.latitude,10.5-0.05);
    assert.equal(partial.at(-1)?.longitude,20.5-0.05);
    assert.equal(new Set(first.map(p=>`${p.latitude},${p.longitude}`)).size,first.length);
    const distributed=generateGrid({...area,boundingBox:{minLatitude:0,minLongitude:0,maxLatitude:4,maxLongitude:4},spacingDegrees:1,maxCandidates:4});
    assert.equal(new Set(distributed.map(p=>p.row)).size,4);
  });
  it("rejects invalid bounding boxes, spacing, and request counts",()=>{
    assert.notEqual(validateStudyArea({...area,boundingBox:{...area.boundingBox,maxLatitude:91}}).length,0);
    assert.notEqual(validateStudyArea({...area,boundingBox:{...area.boundingBox,minLatitude:11}}).length,0);
    assert.notEqual(validateStudyArea({...area,spacingDegrees:0}).length,0);
    assert.notEqual(validateStudyArea({...area,maxCandidates:101}).length,0);
  });
  it("excludes points near known references without mixing candidate and fixture records",()=>{
    const points=generateGrid({...area,maxCandidates:1});
    const partition=excludeReferenceOverlap(points,[{...minimalRef,latitude:points[0].latitude,longitude:points[0].longitude}],5);
    assert.equal(partition.excluded.length,1); assert.equal(partition.excluded[0].nearestReferenceId,"known");
    assert.equal(partition.retained.length,0);
  });
  it("masks a grid cell when its footprint intersects the reference buffer even if its center does not",()=>{
    const point=generateGrid({...area,maxCandidates:1})[0];
    const reference={...minimalRef,latitude:point.latitude+0.12,longitude:point.longitude};
    const partition=excludeReferenceOverlap([point],[reference],5);
    assert.equal(partition.excluded.length,1);
    assert.equal(partition.excluded[0].distanceKm>5,true);
    assert.equal(partition.excluded[0].edgeDistanceKm<=5,true);
  });
  it("reports coordinate-free and invalid references as unmasked instead of using them in distance math",()=>{
    const point=generateGrid({...area,maxCandidates:1})[0];
    const region={...minimalRef,id:"region",latitude:null,longitude:null};
    const invalid={...minimalRef,id:"invalid",latitude:95,longitude:30};
    const result=excludeReferenceOverlap([point],[region,invalid],5);
    assert.deepEqual(result.unmaskedRegionReferenceIds,["region"]);
    assert.deepEqual(result.invalidReferenceIds,["invalid"]);
    assert.equal(result.referenceCoordinatesUsed,0);
  });
  it("screens only evidence presence and reports failures or missing factors as insufficient",async()=>{
    const profile=await json("data/mission-profiles/mars-surface-v1.json") as MissionProfile;
    const mission=profile.missions.find(m=>m.id==="extreme_environment_operations")!;
    const all:FactorEvidence[]=mission.requiredFactorIds.map(factorId=>({factorId,status:"available",value:1,unit:"source unit",sourceId:"mock-source",provenancePath:"mock.json",note:"Mocked evidence for a deterministic logic test."}));
    assert.equal(screenCandidate(profile,mission,all).status,"evidence_supported_for_review");
    const nullValue=all.map((factor,index)=>index===0?{...factor,value:null}:factor);
    assert.equal(screenCandidate(profile,mission,nullValue).status,"insufficient_evidence");
    assert.equal(screenCandidate(profile,mission,nullValue).requiredFactors[0].status,"missing");
    all[0]={...all[0],status:"failed",value:null};
    const partial=screenCandidate(profile,mission,all);
    assert.equal(partial.status,"insufficient_evidence"); assert.equal(partial.missingFactors.includes(mission.requiredFactorIds[0]),true);
    assert.equal(Object.keys(partial).some(key=>/score|rank|weight/i.test(key)),false);
    assert.equal(partial.missionObjective,mission.objective);
    assert.equal(partial.optionalFactors.length,mission.optionalFactorIds.length);
    assert.equal(partial.requiredFactors[0].factorId,mission.requiredFactorIds[0]);
  });
  it("keeps mission-specific requirements distinct and rejects explicitly ineligible references",async()=>{
    const profile=await json("data/mission-profiles/mars-surface-v1.json") as MissionProfile;
    const extreme=profile.missions.find(m=>m.id==="extreme_environment_operations")!;
    const rover=profile.missions.find(m=>m.id==="rover_surface_testing")!;
    assert.notEqual(JSON.stringify(extreme.requiredFactorIds),JSON.stringify(rover.requiredFactorIds));
    assert.notEqual(extreme.objective,rover.objective);
    await assert.rejects(()=>runDiscovery({studyArea:{...area,maxCandidates:1},missionProfile:profile,missionId:extreme.id,references:[minimalRef],referenceEligibility:{policyId:"reference-curation-v1-point-eligibility",policyVersion:"1.0.0",archiveRecordCount:1,excludedReferenceIds:[minimalRef.id]},retrieve:async()=>({})}),/explicitly excluded/);
    const run=await runDiscovery({studyArea:{...area,maxCandidates:1},missionProfile:profile,missionId:extreme.id,references:[minimalRef],referenceEligibility:{policyId:"reference-curation-v1-point-eligibility",policyVersion:"1.0.0",archiveRecordCount:1,excludedReferenceIds:[]},retrieve:async()=>({})});
    assert.equal(run.referenceMasking.eligibilityPolicyId,"reference-curation-v1-point-eligibility");assert.equal(run.referenceMasking.eligibilityPolicyVersion,"1.0.0");assert.deepEqual(run.referenceMasking.pointReferenceIdsUsed,[minimalRef.id]);assert.deepEqual(validateDiscoveryRun(run),[]);
  });
  it("returns stable candidate IDs, keeps source failures explicit, and never returns references as candidates",async()=>{
    const profile=await json("data/mission-profiles/mars-surface-v1.json") as MissionProfile;
    const input={studyArea:{...area,maxCandidates:1},missionProfile:profile,missionId:"extreme_environment_operations",references:[] as LocationRecord[],retrieve:async()=>({climate:{status:"failed",error:"mock network unavailable"},terrain:{status:"failed",error:"mock COG unavailable"},geology:{status:"failed",error:"mock service unavailable"}})};
    const one=await runDiscovery(input),two=await runDiscovery(input);
    assert.notEqual(one.runId,two.runId);
    assert.equal(one.configurationId,two.configurationId); assert.deepEqual(one.candidates,two.candidates);
    assert.equal(one.candidates[0].recordType,"candidate_region"); assert.equal(one.candidates[0].status,"insufficient_evidence");
    assert.equal((one.candidates[0].sources.climate as any).status,"failed");
    assert.deepEqual(validateDiscoveryRun(one),[]);
    const bad=structuredClone(one) as any; bad.candidates[0].ranking=1;
    assert.notEqual(validateDiscoveryRun(bad).length,0);
  });
  it("keeps a successful source when another provider fails and still reports missing mission requirements",async()=>{
    const profile=await json("data/mission-profiles/mars-surface-v1.json") as MissionProfile;
    const run=await runDiscovery({studyArea:{...area,maxCandidates:1},missionProfile:profile,missionId:"extreme_environment_operations",references:[],retrieve:async()=>({climate:{status:"failed",provider:"NASA POWER",error:"unavailable"},terrain:{status:"success",rawPath:"mock-dem.json",normalized:{elevationSampleM:{value:12,unit:"m"},productId:"mock-dem",productVersion:"test",tileId:"mock-tile",sourceUrl:"mock://dem",providerResponseCoordinate:null,retrievedAt:"2026-01-01T00:00:00Z",provenance:{provider:"mock",dataset:"mock fixture",sourceUrl:"mock://dem",tileId:"mock-tile",retrievedAt:"2026-01-01T00:00:00Z"},limitations:["Mocked test only"]}},geology:{status:"failed",provider:"GLiM",error:"unavailable"}})});
    assert.equal((run.candidates[0].sources.terrain as any).status,"success");
    assert.equal((run.candidates[0].sources.climate as any).status,"failed");
    assert.equal(run.candidates[0].status,"insufficient_evidence");
  });
  it("retains overlapping generated points as explicit rejected results",async()=>{
    const profile=await json("data/mission-profiles/mars-surface-v1.json") as MissionProfile;
    const onePoint={...area,maxCandidates:1,referenceExclusionKm:5};
    const point=generateGrid(onePoint)[0]; const ref={...minimalRef,latitude:point.latitude,longitude:point.longitude};
    const run=await runDiscovery({studyArea:onePoint,missionProfile:profile,missionId:"rover_surface_testing",references:[ref]});
    assert.equal(run.candidates[0].status,"rejected_reference_overlap");
    assert.equal(run.candidates[0].sources.climate,undefined);
  });
});
