export interface ReferenceSite {
  id:string; recordType:"known_analog"; regionName:string|null; country:string|null; latitude:number|null; longitude:number|null;
  coordinatesApproximate:boolean|null; spatialGranularity:"point_or_area"|"region_level"; climate:Record<string,unknown>;
  terrain:Record<string,unknown>; elevationSampleM?:{value:number|null;unit:string|null}; elevationMeanM?:{value:number|null;unit:string|null}; geology:{lithology?:{classification:string|null};[key:string]:unknown}; provenance:Record<string,unknown>[]; limitations:string[];
  curation?:{preliminaryDecision:string;decisionRationale:string;locationType:string;pointComparisonEligible:boolean;coordinateAssessment:{providerSamplingDefensible:boolean};evidenceByDimension:Record<string,{status:string;note:string}>;claimCitations:{title:string;doiOrStableUrl:string;supportedClaimOrDimension:string;limitations:string}[];knownLimitations:string[]}|null;
}
export interface RunSummary { runId:string; createdAt:string; status:string; missionId?:string; missionName?:string|null; targetBody?:string|null; candidateCount?:number; earthCandidateCount?:number; comparisonRunId?:string|null; comparisonPairCount?:number; referenceCount?:number; discoveryRunId?:string|null; configurationId?:string; studyArea?:string|null; studyAreaId?:string|null; searchScope?:{kind:string;bounds:{minLatitude:number;minLongitude:number;maxLatitude:number;maxLongitude:number};spacingDegrees:number|null;configuredCellLimit:number|null}|null; }
export interface ApiSummary { referenceCount:number; fixtureCount:number; candidateCount:number; comparisonPairCount:number; latestDiscoveryRunId:string|null; latestComparisonRunId:string|null; latestDiscovery:any; latestComparison:any; }
const apiBaseUrl=(import.meta.env.VITE_API_BASE_URL??"").replace(/\/+$/,"");
export async function api<T>(path:string, options?:RequestInit):Promise<T>{
  const response=await fetch(`${apiBaseUrl}/api${path}`,{...options,headers:{...(options?.body?{"content-type":"application/json"}:{}),...options?.headers}});
  if(!response.ok){const err=await response.json().catch(()=>({error:`Request failed (${response.status})`}));throw new Error(err.error??`Request failed (${response.status})`);}
  return response.json() as Promise<T>;
}

/** Load large comparison archives as bounded API pages, pinning follow-up requests
 * to the run ID returned by the first latest-head response. */
export async function comparisonRun<T extends {runId:string;comparisons:unknown[];pagination?:{totalRecords:number;limit:number}}>(path:string):Promise<T>{
  const first=await api<T>(`${path}${path.includes("?")?"&":"?"}offset=0&limit=12`);
  if(!first.pagination)return first;
  const stablePath=path.endsWith("/latest")?`${path.slice(0,-"latest".length)}${encodeURIComponent(first.runId)}`:path;
  const total=first.pagination.totalRecords,limit=first.pagination.limit;
  const pages=await Promise.all(Array.from({length:Math.ceil(total/limit)-1},(_,index)=>api<T>(`${stablePath}${stablePath.includes("?")?"&":"?"}offset=${(index+1)*limit}&limit=${limit}`)));
  if(pages.some((page)=>page.runId!==first.runId||page.pagination?.totalRecords!==total))throw new Error("Comparison run changed while its pages were loading. Refresh and retry.");
  const {pagination:_pagination,...metadata}=first;
  return {...metadata,comparisons:[...first.comparisons,...pages.flatMap((page)=>page.comparisons)]} as T;
}
