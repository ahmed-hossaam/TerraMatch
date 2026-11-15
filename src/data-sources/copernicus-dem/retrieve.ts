import { COPERNICUS_DEM_HORIZONTAL_CRS, COPERNICUS_DEM_PRODUCT, COPERNICUS_DEM_UNIT, COPERNICUS_DEM_VERSION, COPERNICUS_DEM_VERTICAL_DATUM, resolveCopernicusGlo30Tile, pixelForCoordinate } from "./config.js";

export interface DemSite { id: string; latitude: number | null; longitude: number | null; coordinatesApproximate: boolean | null; }
export interface DemRetrieveOptions { force?: boolean; timeoutMs?: number; retries?: number; fetcher?: typeof fetch; openGeoTiff?: (url: string, options?: Record<string, unknown>) => Promise<any>; }
export function validateDemCoordinate(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) throw new Error("Site coordinates are missing.");
  resolveCopernicusGlo30Tile(latitude, longitude);
  return { latitude, longitude };
}

async function defaultGeoTiff(url: string, options: Record<string, unknown>) {
  const lib = await import("geotiff");
  return lib.fromUrl(url, options);
}
async function withTimeout<T>(work: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([work, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs} ms.`)), timeoutMs); })]);
  } finally { clearTimeout(timer!); }
}

export async function retrieveCopernicusSample(site: DemSite, options: DemRetrieveOptions = {}) {
  const requestedCoordinate = validateDemCoordinate(site.latitude, site.longitude);
  const tile = resolveCopernicusGlo30Tile(requestedCoordinate.latitude, requestedCoordinate.longitude);
  const open = options.openGeoTiff ?? defaultGeoTiff;
  const attempts = Math.max(0, options.retries ?? 2) + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let tiff: any;
    try {
      const timeoutMs = options.timeoutMs ?? 30000;
      tiff = await withTimeout(open(tile.assetUrl, { allowFullFile: false, blockSize: 65536, cacheSize: 8 }), timeoutMs, "Opening remote COG");
      const image: any = await withTimeout<any>(tiff.getImage(), timeoutMs, "Reading GeoTIFF metadata");
      const width = Number(image.getWidth()), height = Number(image.getHeight());
      const origin = image.getOrigin(), resolution = image.getResolution(), keys = image.getGeoKeys?.() ?? {};
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error("GeoTIFF dimensions are invalid.");
      const horizontalEpsg = keys.GeographicTypeGeoKey ?? keys.ProjectedCSTypeGeoKey ?? null;
      if (horizontalEpsg !== 4326) throw new Error(`Unsupported or unverified GeoTIFF CRS (EPSG:${horizontalEpsg ?? "unknown"}); expected EPSG:4326.`);
      const transformTag = image.fileDirectory?.getValue ? await image.fileDirectory.getValue("ModelTransformation") : image.fileDirectory?.ModelTransformation;
      if (Array.isArray(transformTag) && (transformTag[1] !== 0 || transformTag[4] !== 0)) throw new Error("Rotated GeoTIFF affine transforms are not supported by this point sampler.");
      if (!origin || !resolution || resolution.length < 2 || ![...origin, ...resolution].every(Number.isFinite)) throw new Error("GeoTIFF georeferencing metadata is incomplete.");
      const transform = [origin[0], resolution[0], 0, origin[1], 0, resolution[1]];
      const { row, col } = pixelForCoordinate(transform, requestedCoordinate.longitude, requestedCoordinate.latitude, width, height);
      const values = await image.readRasters({ window: [col, row, col + 1, row + 1], width: 1, height: 1, interleave: true, signal: AbortSignal.timeout(timeoutMs) });
      const rawValue = Number(values[0]);
      const noDataRaw = image.getGDALNoData?.() ?? image.fileDirectory?.GDAL_NODATA ?? null;
      const nodataValue = noDataRaw === null || noDataRaw === undefined ? null : Number(noDataRaw);
      const isMissing = !Number.isFinite(rawValue) || (nodataValue !== null && rawValue === nodataValue);
      const sampleLongitude = origin[0] + (col + 0.5) * resolution[0];
      const sampleLatitude = origin[1] + (row + 0.5) * resolution[1];
      const epsg = horizontalEpsg;
      const now = new Date().toISOString();
      return {
        recordType: "copernicus-dem-point-sample", locationId: site.id, requestedCoordinate,
        coordinatesApproximate: site.coordinatesApproximate,
        sourceAsset: { productId: COPERNICUS_DEM_PRODUCT, version: COPERNICUS_DEM_VERSION, tileId: tile.id, sourceUrl: tile.assetUrl },
        sampleCoordinate: { latitude: sampleLatitude, longitude: sampleLongitude },
        elevation: { value: isMissing ? null : rawValue, unit: COPERNICUS_DEM_UNIT, qualityStatus: isMissing ? "missing" : "valid", rawValue: Number.isFinite(rawValue) ? rawValue : null },
        raster: { horizontalCrs: `EPSG:${epsg}`, verticalDatum: COPERNICUS_DEM_VERTICAL_DATUM, verticalDatumGeoKey: keys.VerticalDatumGeoKey ?? null, width, height, origin: [...origin], resolution: [...resolution], resolutionArcSeconds: { x: Math.abs(resolution[0]) * 3600, y: Math.abs(resolution[1]) * 3600 }, nominalResolutionM: 30, nodataValue, sampleMethod: "geotiff.js remote COG range reads; nearest containing raster pixel; no interpolation", noDataStatus: isMissing ? "nodata" : "valid" },
        retrievedAt: now,
        limitations: ["Copernicus DEM GLO-30 Public is a DSM, not bare-earth terrain.", "One pixel is sampled; no slope, roughness, or neighborhood statistics are computed.", "Product accuracy specifications are global statistics and do not guarantee local accuracy."]
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || /timed out|fetch failed|ECONN|ETIMEDOUT|HTTP 429|HTTP 5\d\d|status code 5\d\d|range request failed/i.test(message));
      if (attempt + 1 < attempts && retryable) await new Promise(resolve => setTimeout(resolve, Math.min(500 * 2 ** attempt, 2000)));
      else break;
    } finally {
      try { await tiff?.close?.(); } catch { /* Closing a failed remote source is best effort. */ }
    }
  }
  throw new Error(`Copernicus DEM request failed for ${site.id} (${tile.assetUrl}): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
