import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COPERNICUS_DEM_HORIZONTAL_CRS, COPERNICUS_DEM_PRODUCT, COPERNICUS_DEM_UNIT, COPERNICUS_DEM_VERSION, COPERNICUS_DEM_VERTICAL_DATUM, pixelForCoordinate, resolveCopernicusGlo30Tile } from "../src/data-sources/copernicus-dem/config.js";
import { normalizeCopernicusSample } from "../src/data-sources/copernicus-dem/normalize.js";
import { retrieveCopernicusSample } from "../src/data-sources/copernicus-dem/retrieve.js";
import { makeCandidateFixture } from "../src/normalization/fixtures.js";

const site = { ...makeCandidateFixture("GKC", 22.8, 26.2), recordType: "known_analog" as const, coordinatesApproximate: true };
const tile = resolveCopernicusGlo30Tile(site.latitude!, site.longitude!);
function raw(overrides: Record<string, any> = {}) {
  return { recordType: "copernicus-dem-point-sample", locationId: "GKC", requestedCoordinate: { latitude: 22.8, longitude: 26.2 }, coordinatesApproximate: true,
    sourceAsset: { productId: COPERNICUS_DEM_PRODUCT, version: COPERNICUS_DEM_VERSION, tileId: tile.id, sourceUrl: tile.assetUrl }, sampleCoordinate: { latitude: 22.8001, longitude: 26.2001 },
    elevation: { value: 123.4, unit: COPERNICUS_DEM_UNIT, qualityStatus: "valid", rawValue: 123.4 },
    raster: { horizontalCrs: COPERNICUS_DEM_HORIZONTAL_CRS, verticalDatum: COPERNICUS_DEM_VERTICAL_DATUM, resolutionArcSeconds: { x: 1, y: 1 }, nodataValue: null, sampleMethod: "Nearest containing pixel" },
    retrievedAt: "2026-11-14T13:00:00.000Z", limitations: [], ...overrides };
}

describe("Copernicus DEM point adapter", () => {
  it("resolves a one-degree GLO-30 COG tile and asset URL", () => {
    assert.equal(tile.id, "Copernicus_DSM_COG_10_N22_00_E026_00_DEM");
    assert.equal(tile.assetUrl, `https://copernicus-dem-30m.s3.amazonaws.com/${tile.id}/${tile.id}.tif`);
    assert.equal(resolveCopernicusGlo30Tile(37.69, -6.56).id, "Copernicus_DSM_COG_10_N37_00_W007_00_DEM");
  });
  it("rejects invalid coordinates and outer boundary coordinates", () => {
    assert.throws(() => resolveCopernicusGlo30Tile(91, 0), /Latitude/);
    assert.throws(() => resolveCopernicusGlo30Tile(0, 181), /Longitude/);
    assert.throws(() => resolveCopernicusGlo30Tile(90, 0), /outer tile boundary/);
  });
  it("normalizes elevation, actual pixel coordinate, CRS, resolution, and provenance", () => {
    const result = normalizeCopernicusSample(raw(), site);
    assert.equal(result.elevationSampleM.value, 123.4);
    assert.equal(result.elevationSampleM.unit, "m");
    assert.equal(result.elevationSampleM.qualityStatus, "valid");
    assert.deepEqual(result.requestedCoordinate, { latitude: 22.8, longitude: 26.2 });
    assert.deepEqual(result.providerResponseCoordinate, { latitude: 22.8001, longitude: 26.2001 });
    assert.equal(result.coordinatesApproximate, true);
    assert.equal(result.verticalDatum, "EGM2008 (EPSG:3855)");
    assert.equal(result.provenance.requestParameters.latitude, 22.8);
    assert.equal(result.provenance.qualityStatus, "needs_verification");
    assert.equal(result.limitations.some(x => x.includes("approximate")), true);
    assert.equal(result.limitations.some(x => x.includes("digital surface model")), true);
  });
  it("keeps missing elevations null rather than treating them as zero", () => {
    const result = normalizeCopernicusSample(raw({ elevation: { value: null, unit: "m", qualityStatus: "missing", rawValue: -9999 } }), site);
    assert.equal(result.elevationSampleM.value, null);
    assert.equal(result.elevationSampleM.qualityStatus, "missing");
    assert.notEqual(result.elevationSampleM.value, 0);
  });
  it("rejects unit, coordinate, tile, and provenance mismatches", () => {
    assert.throws(() => normalizeCopernicusSample(raw({ elevation: { value: 100, unit: "ft", qualityStatus: "valid", rawValue: 100 } }), site), /meters/);
    assert.throws(() => normalizeCopernicusSample(raw({ requestedCoordinate: { latitude: 22.81, longitude: 26.2 } }), site), /coordinates/);
    assert.throws(() => normalizeCopernicusSample(raw({ sourceAsset: { ...raw().sourceAsset, tileId: "wrong" } }), site), /tile or URL/);
    assert.throws(() => normalizeCopernicusSample({ ...raw(), locationId: "OTHER" }, site), /does not match/);
  });
  it("maps a coordinate to its containing pixel including edge and bounds checks", () => {
    const transform = [26, 1 / 3600, 0, 23, 0, -1 / 3600];
    assert.deepEqual(pixelForCoordinate(transform, 26.0002, 22.9998, 3600, 3600), { row: 0, col: 0 });
    assert.throws(() => pixelForCoordinate(transform, 27.001, 22, 3600, 3600), /outside raster/);
    assert.deepEqual(pixelForCoordinate(transform, 26.2, 22, 3600, 3600), { row: 3599, col: 720 });
  });
  it("reads a single range-backed pixel and preserves verified raster metadata", async () => {
    let sourceUrl = "";
    const sample = await retrieveCopernicusSample({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, {
      retries: 0, openGeoTiff: async (url) => { sourceUrl = url; return { getImage: async () => ({ getWidth: () => 3600, getHeight: () => 3600, getOrigin: () => [26, 23], getResolution: () => [1 / 3600, -1 / 3600], getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }), getGDALNoData: () => -9999, readRasters: async ({ window }: any) => { assert.deepEqual(window, [720, 720, 721, 721]); return [321.25]; } }) }; }
    });
    assert.equal(sourceUrl, tile.assetUrl);
    assert.equal(sample.elevation.value, 321.25);
    assert.equal(sample.raster.horizontalCrs, "EPSG:4326");
    assert.equal(sample.raster.nodataValue, -9999);
    assert.equal(sample.raster.resolutionArcSeconds.x, 1);
    assert.equal(sample.coordinatesApproximate, true);
  });
  it("keeps nodata null and surfaces unsupported CRS and range source failures", async () => {
    const open = async () => ({ getImage: async () => ({ getWidth: () => 3600, getHeight: () => 3600, getOrigin: () => [26, 23], getResolution: () => [1 / 3600, -1 / 3600], getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }), getGDALNoData: () => -9999, readRasters: async () => [-9999] }) });
    const nodata: any = await retrieveCopernicusSample({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { openGeoTiff: open, retries: 0 });
    assert.equal(nodata.elevation.value, null);
    assert.equal(nodata.elevation.qualityStatus, "missing");
    await assert.rejects(() => retrieveCopernicusSample({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { retries: 0, openGeoTiff: async () => ({ getImage: async () => ({ getWidth: () => 4, getHeight: () => 4, getOrigin: () => [26, 23], getResolution: () => [1, -1], getGeoKeys: () => ({ GeographicTypeGeoKey: 3857 }) }) }) }), /Unsupported or unverified GeoTIFF CRS/);
    await assert.rejects(() => retrieveCopernicusSample({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { retries: 0, openGeoTiff: async () => { throw new Error("HTTP 403 range rejected"); } }), /HTTP 403 range rejected/);
  });
});
