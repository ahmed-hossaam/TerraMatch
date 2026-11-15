import type { LocationRecord } from "../../types/location.js";
import { COPERNICUS_DEM_HORIZONTAL_CRS, COPERNICUS_DEM_PRODUCT, COPERNICUS_DEM_RESOLUTION_M, COPERNICUS_DEM_UNIT, COPERNICUS_DEM_VERSION, COPERNICUS_DEM_VERTICAL_DATUM, resolveCopernicusGlo30Tile } from "./config.js";

export interface CopernicusRawSample {
  recordType: "copernicus-dem-point-sample";
  locationId: string;
  requestedCoordinate: { latitude: number; longitude: number };
  coordinatesApproximate: boolean | null;
  sourceAsset: { productId: string; version: string; tileId: string; sourceUrl: string };
  sampleCoordinate: { latitude: number; longitude: number } | null;
  elevation: { value: number | null; unit: string; qualityStatus: "valid" | "missing"; rawValue: number | null };
  raster: { horizontalCrs: string; verticalDatum: string; resolutionArcSeconds: { x: number; y: number }; nodataValue: number | null; sampleMethod: string };
  retrievedAt: string;
  limitations: string[];
}
export interface NormalizedElevationSample {
  locationId: string; requestedCoordinate: { latitude: number; longitude: number }; coordinatesApproximate: boolean | null;
  providerResponseCoordinate: { latitude: number; longitude: number } | null;
  elevationSampleM: { value: number | null; unit: "m"; sourceId: string; qualityStatus: "valid" | "missing"; processingMethod: string; observationPeriod: null };
  productId: string; productVersion: string; tileId: string; sourceUrl: string;
  horizontalCrs: string; verticalDatum: string; spatialResolutionNominalM: number; resolutionArcSeconds: { x: number; y: number };
  retrievedAt: string; provenance: { provider: string; dataset: string; sourceUrl: string; tileId: string; retrievedAt: string; requestParameters: Record<string, number>; originalUnit: string; outputUnit: string; processingMethod: string; qualityStatus: "needs_verification" };
  limitations: string[];
}

function isObject(value: unknown): value is Record<string, any> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function normalizeCopernicusSample(raw: unknown, knownSite: LocationRecord): NormalizedElevationSample {
  if (!isObject(raw) || raw.recordType !== "copernicus-dem-point-sample") throw new Error("Raw Copernicus DEM sample has an invalid recordType.");
  const sample = raw as unknown as CopernicusRawSample;
  if (sample.locationId !== knownSite.id) throw new Error(`Sample site ID ${sample.locationId} does not match known site ${knownSite.id}.`);
  if (knownSite.latitude === null || knownSite.longitude === null || sample.requestedCoordinate?.latitude !== knownSite.latitude || sample.requestedCoordinate?.longitude !== knownSite.longitude) throw new Error("Requested sample coordinates do not match the normalized atlas site.");
  if (sample.coordinatesApproximate !== knownSite.coordinatesApproximate) throw new Error("Approximate-coordinate status does not match the normalized atlas record.");
  const expectedTile = resolveCopernicusGlo30Tile(knownSite.latitude, knownSite.longitude);
  if (sample.sourceAsset?.productId !== COPERNICUS_DEM_PRODUCT || sample.sourceAsset.version !== COPERNICUS_DEM_VERSION) throw new Error("Unexpected Copernicus DEM product or version.");
  if (sample.sourceAsset.tileId !== expectedTile.id || sample.sourceAsset.sourceUrl !== expectedTile.assetUrl) throw new Error("Source tile or URL does not correspond to this coordinate.");
  if (sample.elevation?.unit !== COPERNICUS_DEM_UNIT) throw new Error("Copernicus DEM elevations must be expressed in meters.");
  if (sample.raster?.horizontalCrs !== COPERNICUS_DEM_HORIZONTAL_CRS || sample.raster.verticalDatum !== COPERNICUS_DEM_VERTICAL_DATUM) throw new Error("Unexpected Copernicus DEM CRS or vertical datum.");
  if (sample.elevation.value !== null && (!Number.isFinite(sample.elevation.value) || sample.elevation.qualityStatus !== "valid")) throw new Error("Elevation must be a finite valid value or null.");
  if (sample.elevation.value === null && sample.elevation.qualityStatus !== "missing") throw new Error("Missing elevation must have missing quality status.");
  if (sample.elevation.value !== null && sample.elevation.rawValue !== sample.elevation.value) throw new Error("Normalized elevation must preserve its raw source value.");
  if (!Number.isFinite(sample.raster.resolutionArcSeconds.x) || !Number.isFinite(sample.raster.resolutionArcSeconds.y) || sample.raster.resolutionArcSeconds.x <= 0 || sample.raster.resolutionArcSeconds.y <= 0) throw new Error("Raster resolution metadata is invalid.");
  if (!Number.isFinite(Date.parse(sample.retrievedAt))) throw new Error("Retrieval timestamp is invalid.");
  const sampleCoordinate = sample.sampleCoordinate && Number.isFinite(sample.sampleCoordinate.latitude) && Number.isFinite(sample.sampleCoordinate.longitude) ? sample.sampleCoordinate : null;
  const limitations = [...(sample.limitations ?? [])];
  if (knownSite.coordinatesApproximate === true) limitations.push("Atlas point coordinates are approximate; the raster sample must not be described as an exact site measurement.");
  limitations.push("Copernicus GLO-30 is a digital surface model (DSM), including vegetation and built structures; it is not bare-earth terrain.");
  return {
    locationId: knownSite.id, requestedCoordinate: { latitude: knownSite.latitude, longitude: knownSite.longitude }, coordinatesApproximate: knownSite.coordinatesApproximate,
    providerResponseCoordinate: sampleCoordinate,
    elevationSampleM: { value: sample.elevation.value, unit: "m", sourceId: "copernicus-dem-glo-30", qualityStatus: sample.elevation.value === null ? "missing" : "valid", processingMethod: sample.elevation.value === null ? "NoData/missing raster sample preserved as null" : "Nearest containing GLO-30 raster pixel sample; no interpolation or terrain metric calculated", observationPeriod: null },
    productId: sample.sourceAsset.productId, productVersion: sample.sourceAsset.version, tileId: sample.sourceAsset.tileId, sourceUrl: sample.sourceAsset.sourceUrl,
    horizontalCrs: sample.raster.horizontalCrs, verticalDatum: sample.raster.verticalDatum, spatialResolutionNominalM: COPERNICUS_DEM_RESOLUTION_M, resolutionArcSeconds: sample.raster.resolutionArcSeconds,
    retrievedAt: sample.retrievedAt, provenance: { provider: "Copernicus DEM via AWS Public Dataset", dataset: `${sample.sourceAsset.productId}; ${sample.sourceAsset.version}`, sourceUrl: sample.sourceAsset.sourceUrl, tileId: sample.sourceAsset.tileId, retrievedAt: sample.retrievedAt, requestParameters: { latitude: knownSite.latitude, longitude: knownSite.longitude }, originalUnit: sample.elevation.unit, outputUnit: "m", processingMethod: sample.raster.sampleMethod, qualityStatus: "needs_verification" }, limitations
  };
}
