import { describe,it } from "node:test";
import assert from "node:assert/strict";
import { compareCandidateToReferences, createComparisonRun, validateComparisonRun } from "../src/comparison/compare.js";
import type { LocationRecord } from "../src/types/location.js";

const daily=(id:string,values:(number|null)[],unit="°C",period={start:"2001-01-01",end:"2001-01-03"})=>({locationId:id,provider:"NASA POWER",actualObservationPeriod:period,parameters:["T2M"],daily:values.map((value,index)=>({date:`2001-01-0${index+1}`,measurements:{T2M:{value,unit,provider:"NASA POWER",parameterId:"T2M",qualityStatus:value===null?"missing":"valid"}}})),provenance:{sourceId:"nasa-power-daily",sourceUrl:"https://power.example"}});
const ref=(id:string,lat:number|null=5):LocationRecord=>({id,recordType:"known_analog",planet:"Earth",latitude:lat,longitude:lat===null?null:6,coordinatesApproximate:true,country:null,regionName:id,discoveryMethod:"test",elevationMeanM:{value:null,unit:"m",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},elevationSampleM:{value:100,unit:"m",sourceId:"copernicus-dem-glo-30",qualityStatus:"needs_verification",processingMethod:"point",observationPeriod:null},climate:{observationPeriod:null,meanTemperatureC:{value:null,unit:"°C",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},meanDailyTemperatureRangeC:{value:null,unit:"°C",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},meanHumidityPct:{value:null,unit:"%",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},annualPrecipitationMm:{value:null,unit:"mm/year",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},meanWindSpeedMs:{value:null,unit:"m/s",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},meanSolarRadiation:{value:null,unit:"MJ/m²/day",sourceId:"missing",qualityStatus:"missing",processingMethod:"missing",observationPeriod:null},missingDays:null,validDays:null,coverage:null},terrain:{elevationMinM:null as any,elevationMaxM:null as any,slopeMeanDeg:null as any,slopeP95Deg:null as any,roughness:null as any,rasterResolutionM:30,sourceId:"copernicus-dem-glo-30",qualityStatus:"needs_verification"},geology:{lithology:{classification:null,sourceId:"glim-v1.1-level-i",qualityStatus:"needs_verification"},minerals:[],formationDescription:null,rockDescription:null,references:[],evidenceQuality:"needs_verification"},dataQuality:{coverage:null,confidence:null,missingFactors:[],warnings:[],validationErrors:[],qualityNotes:[]},provenance:[],atlas:null});
const candidate:any={id:"CAND-1",recordType:"candidate_region",latitude:5,longitude:7,status:"insufficient_evidence",screening:{requiredFactors:[],missingFactors:[]},evidence:[],sources:{climate:{status:"success",rawPath:"raw-candidate.json",normalizedDailyPath:"candidate-daily.json",provenance:{provider:"NASA POWER"}},terrain:{status:"failed",error:"network"},geology:{status:"success",classificationStatus:"mapped",features:[{levels:{xx:"vb",yy:"py",zz:"__"},descriptions:{xx:"Basic volcanic rocks",yy:"Pyroclastics mentioned",zz:null},originalAttributes:{}}],rawPath:"candidate-glim.json",provenance:{provider:"GLiM"}}}};
const context:any={candidateHistories:{"CAND-1":daily("CAND-1",[1,null,5])},referenceHistories:{R1:daily("R1",[2,4,6])},referenceTerrains:{},referenceGeologies:{R1:{lithologyEvidence:{status:"mapped",features:[{levels:{xx:"vb",yy:"mx",zz:"__"},descriptions:{xx:"Basic volcanic rocks",yy:"Mixed grain size",zz:null}}]}}}};

describe("M08 evidence-based comparisons",()=>{
  it("compares compatible daily climate distributions with counts, coverage, units, dates and source provenance",()=>{
    const rangeContext={...context,candidateHistories:{"CAND-1":{...daily("CAND-1",[1,null,5]),daily:daily("CAND-1",[1,null,5]).daily?.map((day,index)=>({...day,temperatureRangeC:{value:index+4,unit:"°C",qualityStatus:"valid"}}))}},referenceHistories:{R1:{...daily("R1",[2,4,6]),daily:daily("R1",[2,4,6]).daily?.map((day,index)=>({...day,temperatureRangeC:{value:index+5,unit:"°C",qualityStatus:"valid"}}))}}};
    const pairs=compareCandidateToReferences(candidate,[ref("R1")],rangeContext);
    const t2m=pairs[0].factors.find((f:any)=>f.factorId==="T2M");
    assert.equal(t2m.status,"compared");assert.equal(t2m.result.candidateMinusReference.median,-1);assert.equal(t2m.candidate.validObservationCount,2);assert.equal(t2m.reference.validObservationCount,3);assert.equal(t2m.unit,"°C");assert.equal(t2m.candidate.path,"candidate-daily.json");assert.equal(t2m.candidate.temporal.seasonal.find((x:any)=>x.label==="Winter").validObservationCount,2);assert.equal(t2m.candidate.temporal.seasonal.find((x:any)=>x.label==="Winter").missingObservationCount,1);assert.equal(t2m.candidate.temporal.yearly[0].validObservationCount,2);assert.equal(t2m.candidate.temporal.yearly[0].missingObservationCount,1);assert.match(t2m.candidate.temporal.seasonDefinition,/Northern Hemisphere/);
    const range=pairs[0].factors.find((f:any)=>f.factorId==="daily_temperature_range");assert.equal(range.status,"compared");assert.match(range.method,/T2M_MAX minus T2M_MIN/);
  });
  it("keeps unit mismatch, period mismatch, empty history, and null-only evidence unavailable",()=>{
    const unit={...context,referenceHistories:{R1:daily("R1",[1,2,3],"K")}};
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],unit)[0].factors[0].status,"unavailable");
    const period={...context,referenceHistories:{R1:daily("R1",[1,2,3],"°C",{start:"2002-01-01",end:"2002-01-03"})}};
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],period)[0].factors[0].status,"unavailable");
    const wrongParameter={...context,candidateHistories:{"CAND-1":{...context.candidateHistories["CAND-1"],daily:context.candidateHistories["CAND-1"].daily.map((day:any)=>({...day,measurements:{T2M:{...day.measurements.T2M,parameterId:"T2M_MIN"}}}))}}};
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],wrongParameter)[0].factors[0].status,"unavailable");
    const empty={...context,candidateHistories:{"CAND-1":{...daily("CAND-1",[]),daily:[]}}};
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],empty)[0].factors[0].status,"unavailable");
    const nulls={...context,candidateHistories:{"CAND-1":daily("CAND-1",[null,null,null])}};
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],nulls)[0].factors[0].status,"unavailable");
    const failedCandidate={...candidate,sources:{...candidate.sources,climate:{status:"failed",error:"mock offline"}}};
    assert.equal(compareCandidateToReferences(failedCandidate,[ref("R1")],{...context,candidateHistories:{"CAND-1":null}})[0].factors[0].status,"failed");
    const summaryOnly={...daily("CAND-1",[]),daily:[],summaries:{T2M:{mean:3,unit:"°C",validObservationCount:3,missingObservationCount:0,coveragePercent:100}}};
    const summaryRef={...daily("R1",[]),daily:[],summaries:{T2M:{mean:1,unit:"°C",validObservationCount:3,missingObservationCount:0,coveragePercent:100}}};
    const summaryContext={...context,candidateHistories:{"CAND-1":summaryOnly},referenceHistories:{R1:summaryRef}};
    const summaryFactor=compareCandidateToReferences(candidate,[ref("R1")],summaryContext)[0].factors[0];assert.equal(summaryFactor.status,"compared");assert.equal(summaryFactor.result.candidateMinusReferenceMean,2);assert.match(summaryFactor.method,/period means/);
  });
  it("compares GLiM categories at matching levels, preserves differences, and flags ambiguous polygons",()=>{
    let factors=compareCandidateToReferences(candidate,[ref("R1")],context)[0].factors;
    assert.equal(factors.find((f:any)=>f.factorId==="glim_xx").result.categoricalMatch,true);
    assert.equal(factors.find((f:any)=>f.factorId==="glim_yy").result.categoricalMatch,false);
    assert.equal(factors.find((f:any)=>f.factorId==="glim_zz").status,"unavailable");
    const ambiguous={...candidate,sources:{...candidate.sources,geology:{...candidate.sources.geology,classificationStatus:"ambiguous",features:[...candidate.sources.geology.features,{levels:{xx:"vb"}}]}}};
    factors=compareCandidateToReferences(ambiguous,[ref("R1")],context)[0].factors;
    assert.equal(factors.find((f:any)=>f.factorId==="glim_xx").status,"ambiguous");
  });
  it("reports only compatible DSM point differences and keeps region-level references in the matrix",()=>{
    const terrainCandidate={...candidate,sources:{...candidate.sources,terrain:{status:"success",elevation:{value:123,unit:"m"},productId:"COP-DEM_GLO-30-Public",tileId:"tile",sourceUrl:"https://dem.example",horizontalCrs:"EPSG:4326",verticalDatum:"EGM2008 (EPSG:3855)",spatialResolutionNominalM:30,provenance:{verticalDatum:"EGM2008 (EPSG:3855)"}}}};
    const compatibleRef={...context,referenceTerrains:{R1:{elevationSampleM:{value:100,unit:"m"},productId:"COP-DEM_GLO-30-Public",horizontalCrs:"EPSG:4326",verticalDatum:"EGM2008 (EPSG:3855)",spatialResolutionNominalM:30}}};
    let factors=compareCandidateToReferences(terrainCandidate,[ref("R1")],compatibleRef)[0].factors;
    const elevation=factors.find((f:any)=>f.factorId==="elevation_point");assert.equal(elevation.result.candidateMinusReferenceM,23);assert.match(elevation.method,/Point-sample elevation difference/);
    const region=compareCandidateToReferences(candidate,[ref("REGION",null)],context)[0];assert.equal(region.referenceCoordinates,null);assert.equal(region.factors.find((f:any)=>f.factorId==="elevation_point").status,"failed");
    assert.equal(compareCandidateToReferences(candidate,[ref("R1")],context)[0].factors.find((f:any)=>f.factorId==="elevation_point").status,"failed");
    const missingDatum={...terrainCandidate,sources:{...terrainCandidate.sources,terrain:{...terrainCandidate.sources.terrain,provenance:{},verticalDatum:undefined,horizontalCrs:undefined,spatialResolutionNominalM:undefined,productId:undefined}}};
    assert.equal(compareCandidateToReferences(missingDatum,[ref("R1")],compatibleRef)[0].factors.find((f:any)=>f.factorId==="elevation_point").status,"unavailable");
  });
  it("supports multiple candidates and references, validates pair provenance, and excludes score/rank fields",()=>{
    const discovery={runId:"discovery-run",missionProfileId:"mars-surface-analog-requirements",missionProfileVersion:"1.0.0",missionId:"extreme_environment_operations",candidates:[candidate,{...candidate,id:"CAND-2"}]};
    const run=createComparisonRun({discoveryRun:discovery,references:[ref("R1"),ref("R2")],...context,referenceHistories:{...context.referenceHistories,R2:daily("R2",[3,4,5])}});
    assert.equal(run.comparisonPairCount,4);assert.deepEqual(validateComparisonRun(run),[]);
    const repeated=createComparisonRun({discoveryRun:discovery,references:[ref("R1"),ref("R2")],...context,referenceHistories:{...context.referenceHistories,R2:daily("R2",[3,4,5])}});
    assert.deepEqual(run.comparisons,repeated.comparisons);
    const score=structuredClone(run) as any;score.comparisons[0].score=0.9;assert.notEqual(validateComparisonRun(score).length,0);
    const fixtureCandidate={...candidate,id:"GRID-TEST-01",recordType:"test_fixture"};assert.throws(()=>compareCandidateToReferences(fixtureCandidate,[ref("R1")],context),/candidate_region/);
  });
});
