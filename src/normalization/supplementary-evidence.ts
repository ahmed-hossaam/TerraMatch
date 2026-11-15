import type { LocationRecord, Measurement, Provenance } from "../types/location.js";

function measure(value:number|null,unit:string,sourceId:string,qualityStatus:"needs_verification"|"missing",processingMethod:string,observationPeriod:string|null):Measurement {
  return {value:Number.isFinite(value)?value:null,unit,sourceId,qualityStatus: Number.isFinite(value)?qualityStatus:"missing",processingMethod,observationPeriod};
}
function summarizeMean(values:Array<number|null|undefined>):number|null { const valid=values.filter((v):v is number=>typeof v==="number"&&Number.isFinite(v)); return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null; }
export function applySupplementaryEvidence(record:LocationRecord,evidence:{climate?:any;terrain?:any;geology?:any}):LocationRecord {
  const output=structuredClone(record); const missing=new Set(output.dataQuality.missingFactors); const provenance:Provenance[]=[];
  const climate=evidence.climate;
  if(climate?.provider==="NASA POWER") {
    const period=climate.actualObservationPeriod, periodLabel=period?.start&&period?.end?`${period.start}/${period.end}`:null, source="nasa-power-daily";
    const summary=(key:string)=>climate.summaries?.[key];
    const range=summarizeMean((climate.daily??[]).map((day:any)=>day.temperatureRangeC?.value));
    const completeYears=(climate.annualPrecipitation??[]).filter((year:any)=>year.complete&&typeof year.totalMm==="number").map((year:any)=>year.totalMm as number);
    const annualPrecip=summarizeMean(completeYears);
    output.climate={observationPeriod:periodLabel,meanTemperatureC:measure(summary("T2M")?.mean??null,"°C",source,"needs_verification","Mean of valid NASA POWER daily T2M observations",periodLabel),meanDailyTemperatureRangeC:measure(range,"°C",source,"needs_verification","Mean of daily T2M_MAX - T2M_MIN only where both inputs are valid",periodLabel),meanHumidityPct:measure(summary("RH2M")?.mean??null,"%",source,"needs_verification","Mean of valid NASA POWER daily RH2M observations",periodLabel),annualPrecipitationMm:measure(annualPrecip,"mm/year",source,"needs_verification",completeYears.length?`Mean of ${completeYears.length} complete calendar-year precipitation totals only` : "No complete calendar-year totals; value remains null",periodLabel),meanWindSpeedMs:measure(summary("WS10M")?.mean??null,"m/s",source,"needs_verification","Mean of valid NASA POWER daily WS10M observations",periodLabel),meanSolarRadiation:measure(summary("ALLSKY_SFC_SW_DWN")?.mean??null,"MJ/m²/day",source,"needs_verification","Mean of valid NASA POWER daily broadband solar-radiation observations; not UV",periodLabel),missingDays:Math.max(0,...Object.values(climate.summaries??{}).map((s:any)=>s.missingObservationCount??0)),validDays:Math.min(...Object.values(climate.summaries??{}).map((s:any)=>s.validObservationCount??0)),coverage:Object.values(climate.summaries??{}).length?Math.min(...Object.values(climate.summaries??{}).map((s:any)=>s.coverage??0)):null};
    missing.delete("NASA POWER climate"); provenance.push({sourceId:source,provider:"NASA POWER",endpointOrDataset:climate.endpoint,sourceUrl:climate.provenance?.sourceUrl??null,retrievedAt:climate.provenance?.retrievedAt??null,requestParameters:climate.provenance?.requestParameters??null,originalUnit:null,outputUnit:null,processingMethod:climate.provenance?.processingMethod??"NASA POWER normalized daily summaries",spatialResolution:climate.provenance?.spatialResolution??"Gridded point product; source dependent",temporalResolution:"Daily; 2001–2020 requested",qualityStatus:"needs_verification"});
  }
  const terrain=evidence.terrain;
  if(terrain?.elevationSampleM) {
    output.terrain={...output.terrain,rasterResolutionM:terrain.spatialResolutionNominalM??30,sourceId:"copernicus-dem-glo-30",qualityStatus:"needs_verification"};
    output.elevationSampleM=measure(terrain.elevationSampleM.value??null,"m","copernicus-dem-glo-30","needs_verification","Single Copernicus GLO-30 DSM pixel sample at the published approximate coordinate; not a site mean or terrain characterization",null);
    if(output.elevationSampleM.value!==null)missing.delete("Copernicus DEM elevation");
    provenance.push({sourceId:"copernicus-dem-glo-30",provider:terrain.provenance?.provider??"Copernicus DEM",endpointOrDataset:terrain.provenance?.dataset??`${terrain.productId}; ${terrain.productVersion}`,sourceUrl:terrain.sourceUrl,retrievedAt:terrain.retrievedAt,requestParameters:terrain.provenance?.requestParameters??null,originalUnit:"m",outputUnit:"m",processingMethod:terrain.provenance?.processingMethod??"One pixel sample; no interpolation",spatialResolution:`Nominal ${terrain.spatialResolutionNominalM??30} m pixel`,temporalResolution:"Static DEM product",qualityStatus:"needs_verification"});
  }
  const geology=evidence.geology;
  if(geology?.lithologyEvidence) {
    const features=geology.lithologyEvidence.features??[];
    const classifications=features.map((feature:any)=>feature.litho).filter((value:any)=>typeof value==="string"&&value.length>0);
    output.geology={...output.geology,lithology:{classification:classifications.length===1?classifications[0]:null,sourceId:"glim-v1.1-level-i",qualityStatus:classifications.length?"needs_verification":"missing"},evidenceQuality:"needs_verification"};
    if(geology.lithologyEvidence.status==="mapped"&&classifications.length===1)missing.delete("GLiM lithology");
    provenance.push({sourceId:"glim-v1.1-level-i",provider:"GLiM ArcGIS Feature Service",endpointOrDataset:geology.provenance?.dataset??geology.glimVersion,sourceUrl:geology.provenance?.sourceUrl??geology.serviceUrl,retrievedAt:geology.retrievedAt,requestParameters:geology.queryGeometry as any,originalUnit:null,outputUnit:"GLiM source code",processingMethod:"Point-in-polygon query; detailed original fields remain in supplementary normalized geology output",spatialResolution:geology.provenance?.spatialResolution??"Generalized global map, about 1:3,750,000 average scale",temporalResolution:"Static map product",qualityStatus:"needs_verification"});
  }
  output.dataQuality.missingFactors=[...missing];
  output.provenance=[...output.provenance,...provenance];
  if(output.coordinatesApproximate===true)output.dataQuality.warnings.push("Point products use an approximate published coordinate; they are not exact measurements at every named site feature.");
  return output;
}
