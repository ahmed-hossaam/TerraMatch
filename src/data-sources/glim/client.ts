import { GLIM_FIELDS, GLIM_INPUT_EPSG, GLIM_LAYER_EPSG, GLIM_LAYER_URL, GLIM_VERSION, buildGlimQuery, validateGlimCoordinate } from "./config.js";

export interface GlimSite { id: string; latitude: number | null; longitude: number | null; coordinatesApproximate: boolean | null; }
export interface GlimClientOptions { fetcher?: typeof fetch; timeoutMs?: number; retries?: number; layerUrl?: string; }
async function requestJson(url: string, init: RequestInit, options: GlimClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const tries = Math.max(0, options.retries ?? 2) + 1;
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? 20000) });
      const text = await response.text();
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && i + 1 < tries) { await new Promise(resolve => setTimeout(resolve, Math.min(500 * 2 ** i, 3000))); continue; }
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
      }
      let json: any;
      try { json = JSON.parse(text); } catch { throw new Error("Service returned malformed JSON."); }
      if (json?.error) throw new Error(`ArcGIS error ${json.error.code ?? "unknown"}: ${json.error.message ?? "unspecified error"} ${JSON.stringify(json.error.details ?? [])}`);
      return { json, text };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || /fetch failed|ECONN|ETIMEDOUT/i.test(error.message));
      if (i + 1 >= tries || !retryable) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(500 * 2 ** i, 3000)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
export async function fetchGlimMetadata(options: GlimClientOptions = {}) {
  const layerUrl = options.layerUrl ?? GLIM_LAYER_URL;
  const serviceUrl = layerUrl.replace(/\/1\/?$/, "");
  const { json: serviceJson, text: serviceText } = await requestJson(`${serviceUrl}?f=pjson`, { method: "GET" }, options);
  const { json, text } = await requestJson(`${layerUrl}?f=pjson`, { method: "GET" }, options);
  const serviceDescription = String(serviceJson.serviceDescription ?? serviceJson.description ?? "");
  if (!/GLiM\s*v?1\.1/i.test(serviceDescription)) throw new Error("ArcGIS service metadata does not identify the expected GLiM v1.1 dataset.");
  if (json.geometryType !== "esriGeometryPolygon") throw new Error(`Expected polygon layer; received ${json.geometryType ?? "unknown"}.`);
  if (!String(json.capabilities ?? "").split(",").includes("Query")) throw new Error("GLiM layer metadata does not advertise query capability.");
  if (!Array.isArray(json.supportedSpatialRelationships) || !json.supportedSpatialRelationships.includes("esriSpatialRelIntersects")) throw new Error("GLiM layer does not advertise point intersection queries.");
  const layerEpsg = json.spatialReference?.latestWkid ?? json.spatialReference?.wkid;
  if (layerEpsg !== GLIM_LAYER_EPSG && layerEpsg !== 102100) throw new Error(`Unexpected GLiM layer spatial reference WKID ${layerEpsg ?? "unknown"}.`);
  const actualFields = (json.fields ?? []).map((field: any) => field.name);
  const missingFields = GLIM_FIELDS.filter(field => !actualFields.includes(field));
  if (missingFields.length) throw new Error(`GLiM layer metadata is missing requested fields: ${missingFields.join(", ")}.`);
  return { json, text, serviceJson, serviceText, serviceUrl, serviceDescription, layerUrl, layerEpsg };
}
export async function queryGlimSite(site: GlimSite, options: GlimClientOptions = {}) {
  const coordinate = validateGlimCoordinate(site.latitude, site.longitude);
  const metadata = await fetchGlimMetadata(options);
  const query = buildGlimQuery(coordinate.latitude, coordinate.longitude, metadata.layerUrl);
  const { json, text } = await requestJson(query.url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: query.body }, options);
  if (!Array.isArray(json.features)) throw new Error("ArcGIS query response does not contain a features array.");
  const retrievedAt = new Date().toISOString();
  return {
    recordType: "glim-point-query", locationId: site.id, requestedCoordinate: coordinate, coordinatesApproximate: site.coordinatesApproximate,
    serviceUrl: metadata.layerUrl, queryUrl: query.url, glimVersion: GLIM_VERSION,
    queryGeometry: { x: coordinate.longitude, y: coordinate.latitude, spatialReference: { wkid: GLIM_INPUT_EPSG, latestWkid: GLIM_INPUT_EPSG } },
    responseSpatialReference: json.spatialReference ?? { wkid: GLIM_INPUT_EPSG, latestWkid: GLIM_INPUT_EPSG }, layerSpatialReference: metadata.json.spatialReference,
    requestedFields: [...GLIM_FIELDS], retrievedAt, rawResponseText: text,
    sourceMetadata: { serviceDescription: metadata.serviceDescription, serviceUrl: metadata.serviceUrl, layerUrl: metadata.layerUrl, geometryType: metadata.json.geometryType, layerName: metadata.json.name, layerId: metadata.json.id, fields: metadata.json.fields, capabilities: metadata.json.advancedQueryCapabilities ?? metadata.json.capabilities, copyrightText: metadata.json.copyrightText, rawServiceMetadataText: metadata.serviceText, rawLayerMetadataText: metadata.text },
    featureCount: json.features.length
  };
}
