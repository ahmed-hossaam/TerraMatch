export const GLIM_VERSION = "GLiM v1.1 (ArcGIS Feature Service description)";
export const GLIM_SERVICE_URL = "https://services8.arcgis.com/4KhTMTZ1x0f76DSg/ArcGIS/rest/services/GLiM_Niveau_I/FeatureServer";
export const GLIM_LAYER_URL = `${GLIM_SERVICE_URL}/1`;
export const GLIM_FIELDS = ["OBJECTID", "IDENTITY_", "Litho", "xx", "yy", "zz", "xx_Description", "yy_Description", "zz_Description"] as const;
export const GLIM_INPUT_EPSG = 4326;
export const GLIM_LAYER_EPSG = 3857;
export function validateGlimCoordinate(latitude: number | null, longitude: number | null) {
  if (latitude === null || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude must be finite and within [-90, 90].");
  if (longitude === null || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Longitude must be finite and within [-180, 180].");
  return { latitude, longitude };
}
export function buildGlimQuery(latitude: number, longitude: number, layerUrl = GLIM_LAYER_URL) {
  validateGlimCoordinate(latitude, longitude);
  const params = new URLSearchParams({
    f: "json", where: "1=1", geometry: JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: GLIM_INPUT_EPSG, latestWkid: GLIM_INPUT_EPSG } }),
    geometryType: "esriGeometryPoint", inSR: String(GLIM_INPUT_EPSG), spatialRel: "esriSpatialRelIntersects",
    outFields: GLIM_FIELDS.join(","), returnGeometry: "true", outSR: String(GLIM_INPUT_EPSG)
  });
  return { url: `${layerUrl.replace(/\/$/, "")}/query`, body: params.toString() };
}
