import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { LocationRecord } from "../types/location.js";
import { DEFAULT_OBSERVATION_PERIOD, DEFAULT_PARAMETERS } from "../data-sources/nasa-power/config.js";
import { NasaPowerClient } from "../data-sources/nasa-power/client.js";
import { retrieveCopernicusSample } from "../data-sources/copernicus-dem/retrieve.js";
import { normalizeCopernicusSample } from "../data-sources/copernicus-dem/normalize.js";
import { queryGlimSite } from "../data-sources/glim/client.js";
import { normalizeGlimRaw } from "../data-sources/glim/normalize.js";
import { NASA_POWER_ENDPOINT } from "../data-sources/nasa-power/config.js";
import { resolveCopernicusGlo30Tile } from "../data-sources/copernicus-dem/config.js";
import { GLIM_LAYER_URL } from "../data-sources/glim/config.js";

export interface PointEvidenceOptions { enableClimate?:boolean; enableTerrain?:boolean; enableGeology?:boolean; timeoutMs?:number; force?:boolean; }
export async function retrievePointEvidence(site: LocationRecord, options: PointEvidenceOptions = {}) {
  if (site.latitude===null||site.longitude===null) throw new Error(`${site.id} has no point coordinate; point retrieval is unavailable for region-level records.`);
  const results: Record<string,any> = {};
  if (options.enableClimate!==false) {
    try {
      const client=new NasaPowerClient({timeoutMs:options.timeoutMs??20000,maxAttempts:1});
      const result=await client.retrieve({locationId:site.id,latitude:site.latitude,longitude:site.longitude,coordinatesApproximate:site.coordinatesApproximate,start:DEFAULT_OBSERVATION_PERIOD.start,end:DEFAULT_OBSERVATION_PERIOD.end,parameters:DEFAULT_PARAMETERS});
      results.climate={status:"success",normalized:result.normalized,rawPath:result.rawPath,metadataPath:result.metadataPath,cacheHit:result.cacheHit};
    } catch(error) { results.climate={status:"failed",provider:"NASA POWER",endpoint:NASA_POWER_ENDPOINT,requestedCoordinate:{latitude:site.latitude,longitude:site.longitude},retrievalAttemptedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error)}; }
  }
  if (options.enableTerrain!==false) {
    const path=`data/raw/copernicus-dem/${site.id}_GLO-30.json`;
    try {
      let raw:any=null;
      if (!options.force) { let exists=true; try { await access(path); } catch { exists=false; } if(exists) { try { raw=JSON.parse(await readFile(path,"utf8")); normalizeCopernicusSample(raw,site); } catch(error) { throw new Error(`Existing DEM raw response is invalid; refusing to overwrite: ${error instanceof Error?error.message:String(error)}`); } } }
      if (!raw||options.force) {
        raw=await retrieveCopernicusSample({id:site.id,latitude:site.latitude,longitude:site.longitude,coordinatesApproximate:site.coordinatesApproximate},{timeoutMs:options.timeoutMs??20000,retries:0});
        await atomicJson(path,raw);
      }
      results.terrain={status:"success",normalized:normalizeCopernicusSample(raw,site),rawPath:path};
    } catch(error) { results.terrain={status:"failed",provider:"Copernicus DEM",sourceUrl:resolveCopernicusGlo30Tile(site.latitude!,site.longitude!).assetUrl,requestedCoordinate:{latitude:site.latitude,longitude:site.longitude},retrievalAttemptedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error),rawPath:null,expectedRawPath:path}; }
  }
  if (options.enableGeology!==false) {
    const path=`data/raw/glim/${site.id}_GLiM.json`;
    try {
      let raw:any=null;
      if (!options.force) { let exists=true; try { await access(path); } catch { exists=false; } if(exists) { try { raw=JSON.parse(await readFile(path,"utf8")); const norm=normalizeGlimRaw(raw); if(norm.locationId!==site.id||norm.requestedCoordinate.latitude!==site.latitude||norm.requestedCoordinate.longitude!==site.longitude||norm.coordinatesApproximate!==site.coordinatesApproximate) throw new Error("Raw GLiM response coordinate or identity mismatch."); } catch(error) { throw new Error(`Existing GLiM raw response is invalid; refusing to overwrite: ${error instanceof Error?error.message:String(error)}`); } } }
      if (!raw||options.force) {
        raw=await queryGlimSite({id:site.id,latitude:site.latitude,longitude:site.longitude,coordinatesApproximate:site.coordinatesApproximate},{timeoutMs:options.timeoutMs??20000,retries:0});
        normalizeGlimRaw(raw); await atomicJson(path,raw);
      }
      results.geology={status:"success",normalized:normalizeGlimRaw(raw),rawPath:path};
    } catch(error) { results.geology={status:"failed",provider:"GLiM ArcGIS Feature Service",sourceUrl:GLIM_LAYER_URL,requestedCoordinate:{latitude:site.latitude,longitude:site.longitude},retrievalAttemptedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error),rawPath:null,expectedRawPath:path}; }
  }
  return results;
}
async function atomicJson(path:string,value:unknown) { await mkdir(path.slice(0,Math.max(path.lastIndexOf("/"),path.lastIndexOf("\\"))),{recursive:true}); const tmp=`${path}.${process.pid??"p"}.tmp`; await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,"utf8"); await rename(tmp,path); }
