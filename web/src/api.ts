export interface ReferenceSite {
  id:string; recordType:"known_analog"; regionName:string|null; country:string|null; latitude:number|null; longitude:number|null;
  coordinatesApproximate:boolean|null; spatialGranularity:"point_or_area"|"region_level"; climate:Record<string,unknown>;
  terrain:Record<string,unknown>; elevationSampleM?:{value:number|null;unit:string|null}; elevationMeanM?:{value:number|null;unit:string|null}; geology:{lithology?:{classification:string|null};[key:string]:unknown}; provenance:Record<string,unknown>[]; limitations:string[];
}
export interface RunSummary { runId:string; createdAt:string; status:string; missionId?:string; candidateCount?:number; comparisonPairCount?:number; referenceCount?:number; configurationId?:string; studyArea?:string; }
export interface ApiSummary { referenceCount:number; fixtureCount:number; candidateCount:number; comparisonPairCount:number; latestDiscoveryRunId:string|null; latestComparisonRunId:string|null; latestDiscovery:any; latestComparison:any; }
const apiBaseUrl=(import.meta.env.VITE_API_BASE_URL??"").replace(/\/+$/,"");
export async function api<T>(path:string, options?:RequestInit):Promise<T>{
  const response=await fetch(`${apiBaseUrl}/api${path}`,{...options,headers:{...(options?.body?{"content-type":"application/json"}:{}),...options?.headers}});
  if(!response.ok){const err=await response.json().catch(()=>({error:`Request failed (${response.status})`}));throw new Error(err.error??`Request failed (${response.status})`);}
  return response.json() as Promise<T>;
}
