import { readFile } from "node:fs/promises";
import { describe,it } from "node:test";
import assert from "node:assert/strict";
import type { LocationRecord } from "../src/types/location.js";
import { applySupplementaryEvidence } from "../src/normalization/supplementary-evidence.js";

const source=async()=>JSON.parse(await readFile("data/processed/supplementary-known-sites.json","utf8"))[0] as LocationRecord;
const climate={provider:"NASA POWER",locationId:"DALL",latitude:14.24,longitude:40.30,coordinatesApproximate:true,actualObservationPeriod:{start:"2001-01-01",end:"2020-12-31"},summaries:Object.fromEntries([["T2M","°C"],["RH2M","%"],["WS10M","m/s"],["ALLSKY_SFC_SW_DWN","MJ/m²/day"]].map(([id,unit])=>[id,{mean:2,validObservationCount:7305,missingObservationCount:0,coverage:1,unit}])),daily:[{temperatureRangeC:{value:8}},{temperatureRangeC:{value:10}}],annualPrecipitation:[{year:2001,totalMm:10,complete:true},{year:2002,totalMm:null,partialObservedSumMm:999,complete:false}],provenance:{sourceId:"nasa-power-daily",endpoint:"daily-point",sourceUrl:"https://power.example",retrievedAt:"2026-11-14T00:00:00Z",requestParameters:{start:"20010101",end:"20201231"},processingMethod:"daily summary",spatialResolution:"gridded"}};

describe("supplementary source normalization",()=>{
  it("links climate, point DEM sample, and GLiM without mislabeling the elevation as a mean or inferring minerals",async()=>{
    const original=await source();
    const record=applySupplementaryEvidence(original,{climate,terrain:{locationId:"DALL",coordinatesApproximate:true,requestedCoordinate:{latitude:14.24,longitude:40.3},elevationSampleM:{value:-93.1,unit:"m",qualityStatus:"valid"},spatialResolutionNominalM:30,productId:"COP-DEM_GLO-30-Public",productVersion:"2021",sourceUrl:"https://dem.example/tile",retrievedAt:"2026-11-14T00:00:00Z",provenance:{provider:"Copernicus DEM",dataset:"GLO-30",sourceUrl:"https://dem.example/tile",requestParameters:{latitude:14.24,longitude:40.3},processingMethod:"pixel sample"}},geology:{locationId:"DALL",coordinatesApproximate:true,requestedCoordinate:{latitude:14.24,longitude:40.3},glimVersion:"GLiM v1.1",serviceUrl:"https://glim.example/layer",retrievedAt:"2026-11-14T00:00:00Z",lithologyEvidence:{status:"mapped",features:[{litho:"suds__"}]},provenance:{dataset:"GLiM v1.1",sourceUrl:"https://glim.example/query",spatialResolution:"1:3,750,000"}}});
    assert.equal(record.climate.meanTemperatureC.value,2);
    assert.equal(record.climate.meanDailyTemperatureRangeC.value,9);
    assert.equal(record.climate.annualPrecipitationMm.value,10);
    assert.equal(record.elevationMeanM.value,null);
    assert.equal(record.elevationSampleM?.value,-93.1);
    assert.equal(record.elevationSampleM?.qualityStatus,"needs_verification");
    assert.equal(record.geology.lithology.classification,"suds__");
    assert.equal(record.geology.minerals.length,0);
    assert.equal(record.dataQuality.missingFactors.includes("site-specific mineral evidence"),true);
    assert.equal(record.provenance.some(p=>p.sourceId==="nasa-power-daily"),true);
  });
  it("keeps null and incomplete annual precipitation missing, never converting partial sums to complete totals",async()=>{
    const original=await source();
    const noComplete={...climate,annualPrecipitation:[{year:2002,totalMm:null,partialObservedSumMm:999,complete:false}],summaries:{T2M:{mean:null,validObservationCount:0,missingObservationCount:7305,coverage:0,unit:"°C"}}};
    const record=applySupplementaryEvidence(original,{climate:noComplete});
    assert.equal(record.climate.annualPrecipitationMm.value,null);
    assert.equal(record.climate.annualPrecipitationMm.qualityStatus,"missing");
    assert.equal(record.climate.meanTemperatureC.value,null);
    assert.equal(record.climate.meanTemperatureC.qualityStatus,"missing");
  });
});
