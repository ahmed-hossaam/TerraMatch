import { GLIM_FIELDS, GLIM_LAYER_URL, GLIM_VERSION } from "./config.js";

export interface GlimRawRecord {
  recordType: "glim-point-query"; locationId: string; requestedCoordinate: { latitude: number; longitude: number };
  coordinatesApproximate: boolean | null; serviceUrl: string; queryUrl: string; glimVersion: string;
  queryGeometry: { x: number; y: number; spatialReference: { wkid: number; latestWkid: number } };
  responseSpatialReference: Record<string, unknown>; layerSpatialReference: Record<string, unknown>;
  requestedFields: string[]; retrievedAt: string; rawResponseText: string; sourceMetadata: Record<string, unknown>; featureCount: number;
}
export interface NormalizedGlimRecord {
  locationId: string; requestedCoordinate: { latitude: number; longitude: number }; coordinatesApproximate: boolean | null;
  serviceUrl: string; layerUrl: string; glimVersion: string; responseSpatialReference: Record<string, unknown>;
  queryGeometry: GlimRawRecord["queryGeometry"]; retrievedAt: string;
  lithologyEvidence: { status: "mapped" | "ambiguous" | "no_data_class" | "no_feature" | "incomplete"; features: Array<{ objectId: unknown; identity: unknown; litho: unknown; levels: { xx: unknown; yy: unknown; zz: unknown }; descriptions: { xx: unknown; yy: unknown; zz: unknown }; originalAttributes: Record<string, unknown>; geometry: unknown }>; };
  provenance: { provider: "GLiM ArcGIS Feature Service"; dataset: string; endpoint: string; sourceUrl: string; retrievedAt: string; requestParameters: Record<string, unknown>; spatialResolution: string; qualityStatus: "needs_verification" };
  warnings: string[]; minerals: [];
}
function object(value: unknown): value is Record<string, any> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function normalizeGlimRaw(rawValue: unknown): NormalizedGlimRecord {
  if (!object(rawValue) || rawValue.recordType !== "glim-point-query") throw new Error("Raw GLiM record has an invalid recordType.");
  const raw = rawValue as unknown as GlimRawRecord;
  if (!raw.locationId || !Number.isFinite(raw.requestedCoordinate?.latitude) || !Number.isFinite(raw.requestedCoordinate?.longitude)) throw new Error("Raw GLiM site or requested coordinate is invalid.");
  if (raw.serviceUrl !== GLIM_LAYER_URL || raw.glimVersion !== GLIM_VERSION) throw new Error("Raw GLiM source URL or version is unexpected.");
  if (!Number.isFinite(Date.parse(raw.retrievedAt))) throw new Error("GLiM retrieval timestamp is invalid.");
  const { json, features } = (() => { let parsed: any; try { parsed = JSON.parse(raw.rawResponseText); } catch { throw new Error("Raw GLiM response is malformed JSON."); } if (parsed?.error) throw new Error(`ArcGIS error ${parsed.error.code ?? "unknown"}: ${parsed.error.message ?? "unspecified error"}`); if (!Array.isArray(parsed?.features)) throw new Error("Raw GLiM response has no features array."); return { json: parsed, features: parsed.features }; })();
  if (features.length !== raw.featureCount) throw new Error("GLiM feature count does not match preserved raw response.");
  const normalizedFeatures = features.map((feature: any) => {
    const attributes = object(feature?.attributes) ? feature.attributes : {};
    const originalAttributes: Record<string, unknown> = {};
    for (const field of GLIM_FIELDS) originalAttributes[field] = Object.hasOwn(attributes, field) ? attributes[field] : null;
    return { objectId: originalAttributes.OBJECTID, identity: originalAttributes.IDENTITY_, litho: originalAttributes.Litho,
      levels: { xx: originalAttributes.xx, yy: originalAttributes.yy, zz: originalAttributes.zz },
      descriptions: { xx: originalAttributes.xx_Description, yy: originalAttributes.yy_Description, zz: originalAttributes.zz_Description },
      originalAttributes, geometry: feature?.geometry ?? null };
  });
  const hasMapped = normalizedFeatures.some((feature: any) => feature.levels.xx !== null || feature.descriptions.xx !== null || feature.litho !== null);
  const noDataClass = normalizedFeatures.some((feature: any) => feature.descriptions.xx === "No Data" || feature.levels.xx === "nd" || feature.litho === "nd");
  const status = features.length === 0 ? "no_feature" : features.length > 1 ? "ambiguous" : noDataClass ? "no_data_class" : hasMapped ? "mapped" : "incomplete";
  const warnings: string[] = [];
  if (raw.coordinatesApproximate === true) warnings.push("Atlas coordinates are approximate; GLiM classification describes mapped polygon(s) intersecting the supplied point, not confirmed geology of the named site.");
  if (features.length === 0) warnings.push("No polygon feature was returned; lithology remains unavailable, not zero or a negative classification.");
  if (features.length > 1) warnings.push(`The query intersected ${features.length} polygons; all are preserved and no single classification was selected.`);
  if (noDataClass) warnings.push("The source class is explicitly No Data; original source values are preserved.");
  if (!hasMapped && features.length && !noDataClass) warnings.push("Returned feature has missing classification attributes.");
  warnings.push("GLiM is a generalized global lithology map, not site-level field-verified mineralogy; lithology does not prove mineral presence.");
  return { locationId: raw.locationId, requestedCoordinate: raw.requestedCoordinate, coordinatesApproximate: raw.coordinatesApproximate,
    serviceUrl: raw.serviceUrl, layerUrl: raw.serviceUrl, glimVersion: raw.glimVersion, responseSpatialReference: raw.responseSpatialReference,
    queryGeometry: raw.queryGeometry, retrievedAt: raw.retrievedAt,
    lithologyEvidence: { status, features: normalizedFeatures },
    provenance: { provider: "GLiM ArcGIS Feature Service", dataset: GLIM_VERSION, endpoint: `${raw.serviceUrl}/query`, sourceUrl: raw.queryUrl, retrievedAt: raw.retrievedAt, requestParameters: { geometry: raw.queryGeometry, outFields: raw.requestedFields, spatialRel: "esriSpatialRelIntersects", inSR: raw.queryGeometry.spatialReference.wkid, outSR: json.spatialReference?.latestWkid ?? json.spatialReference?.wkid ?? null }, spatialResolution: "Global map average scale approximately 1:3,750,000; polygon-specific scale varies.", qualityStatus: "needs_verification" },
    warnings, minerals: [] };
}
