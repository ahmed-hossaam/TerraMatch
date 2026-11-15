export const COPERNICUS_DEM_PRODUCT = "COP-DEM_GLO-30-Public";
export const COPERNICUS_DEM_VERSION = "Copernicus DEM 2021 release";
export const COPERNICUS_DEM_RESOLUTION_M = 30;
export const COPERNICUS_DEM_HORIZONTAL_CRS = "EPSG:4326";
export const COPERNICUS_DEM_VERTICAL_DATUM = "EGM2008 (EPSG:3855)";
export const COPERNICUS_DEM_UNIT = "m";
export const COPERNICUS_DEM_BASE_URL = "https://copernicus-dem-30m.s3.amazonaws.com";
export const COPERNICUS_DEM_HORIZONTAL_CRS_EPSG = 4326;

export interface CopernicusTile { id: string; assetUrl: string; }
function hemisphere(value: number, positive: string, negative: string) { return value < 0 ? negative : positive; }
export function resolveCopernicusGlo30Tile(latitude: number, longitude: number): CopernicusTile {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Latitude must be finite and within [-90, 90].");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Longitude must be finite and within [-180, 180].");
  if (Math.abs(latitude) === 90 || Math.abs(longitude) === 180) throw new Error("Coordinates on the outer tile boundary require adjacent-tile resolution and are not supported by this single-tile resolver.");
  const latDegree = Math.floor(Math.abs(latitude));
  // West-facing tiles are named from their western integer edge: W007 covers [-7, -6).
  const lonDegree = longitude < 0 ? Math.abs(Math.floor(longitude)) : Math.floor(longitude);
  const id = `Copernicus_DSM_COG_10_${hemisphere(latitude, "N", "S")}${String(latDegree).padStart(2, "0")}_00_${hemisphere(longitude, "E", "W")}${String(lonDegree).padStart(3, "0")}_00_DEM`;
  return { id, assetUrl: `${COPERNICUS_DEM_BASE_URL}/${id}/${id}.tif` };
}

export function pixelForCoordinate(geoTransform: number[], longitude: number, latitude: number, width: number, height: number) {
  if (geoTransform.length < 6 || !geoTransform.every(Number.isFinite)) throw new Error("Raster georeferencing transform is invalid.");
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error("Sample coordinates must be finite.");
  const [originX, pixelWidth, rowRotation, originY, colRotation, pixelHeight] = geoTransform;
  const determinant = pixelWidth * pixelHeight - rowRotation * colRotation;
  if (!Number.isFinite(determinant) || determinant === 0) throw new Error("Raster georeferencing transform is singular.");
  const dx = longitude - originX, dy = latitude - originY;
  const colPosition = (dx * pixelHeight - dy * rowRotation) / determinant;
  const rowPosition = (dy * pixelWidth - dx * colRotation) / determinant;
  // The geographic outer edge belongs to two adjacent tiles. Clamp an exact edge to this
  // tile's nearest edge pixel instead of turning it into a missing/out-of-range sample.
  const col = Math.abs(colPosition - width) < 1e-9 ? width - 1 : Math.abs(colPosition) < 1e-9 ? 0 : Math.floor(colPosition + 1e-10);
  const row = Math.abs(rowPosition - height) < 1e-9 ? height - 1 : Math.abs(rowPosition) < 1e-9 ? 0 : Math.floor(rowPosition + 1e-10);
  if (col < 0 || row < 0 || col >= width || row >= height) throw new Error("Coordinate falls outside raster dimensions.");
  return { row, col };
}
