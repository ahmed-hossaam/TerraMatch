import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GLIM_FIELDS, GLIM_LAYER_URL, buildGlimQuery, validateGlimCoordinate } from "../src/data-sources/glim/config.js";
import { normalizeGlimRaw } from "../src/data-sources/glim/normalize.js";
import { queryGlimSite } from "../src/data-sources/glim/client.js";

const attrs = { OBJECTID: 11, IDENTITY_: "test-unit", Litho: "vapy__", xx: "va", yy: "py", zz: "__", xx_Description: "Acid volcanic rocks", yy_Description: "Pyroclastics mentioned", zz_Description: null };
function raw(features: unknown[], overrides: Record<string, unknown> = {}) {
  const response = { features, spatialReference: { wkid: 4326, latestWkid: 4326 } };
  return { recordType: "glim-point-query", locationId: "GKC", requestedCoordinate: { latitude: 22.8, longitude: 26.2 }, coordinatesApproximate: true,
    serviceUrl: GLIM_LAYER_URL, queryUrl: `${GLIM_LAYER_URL}/query`, glimVersion: "GLiM v1.1 (ArcGIS Feature Service description)",
    queryGeometry: { x: 26.2, y: 22.8, spatialReference: { wkid: 4326, latestWkid: 4326 } }, responseSpatialReference: response.spatialReference,
    layerSpatialReference: { wkid: 102100, latestWkid: 3857 }, requestedFields: [...GLIM_FIELDS], retrievedAt: "2026-11-14T12:00:00.000Z",
    rawResponseText: JSON.stringify(response), sourceMetadata: {}, featureCount: features.length, ...overrides };
}
const feature = (attributes: Record<string, unknown> = attrs, objectId = 11) => ({ attributes: { ...attributes, OBJECTID: objectId }, geometry: { rings: [] } });

describe("GLiM point-in-polygon integration", () => {
  it("validates coordinates and sends longitude-first WGS84 point query with declared fields", () => {
    assert.throws(() => validateGlimCoordinate(91, 0), /Latitude/);
    assert.throws(() => validateGlimCoordinate(0, 181), /Longitude/);
    const query = buildGlimQuery(22.8, 26.2);
    const body = new URLSearchParams(query.body);
    assert.equal(body.get("geometryType"), "esriGeometryPoint");
    assert.equal(body.get("inSR"), "4326");
    assert.equal(body.get("outSR"), "4326");
    assert.equal(body.get("spatialRel"), "esriSpatialRelIntersects");
    assert.deepEqual(JSON.parse(body.get("geometry")!), { x: 26.2, y: 22.8, spatialReference: { wkid: 4326, latestWkid: 4326 } });
    assert.equal(body.get("outFields"), GLIM_FIELDS.join(","));
  });
  it("preserves all original levels, descriptions, feature geometry and approximate-location caveat", () => {
    const result = normalizeGlimRaw(raw([feature()]));
    assert.equal(result.lithologyEvidence.status, "mapped");
    assert.equal(result.lithologyEvidence.features[0].levels.xx, "va");
    assert.equal(result.lithologyEvidence.features[0].descriptions.yy, "Pyroclastics mentioned");
    assert.equal(result.lithologyEvidence.features[0].originalAttributes.IDENTITY_, "test-unit");
    assert.equal(result.warnings.some(warning => warning.includes("approximate")), true);
    assert.deepEqual(result.minerals, []);
    assert.equal(result.provenance.requestParameters.inSR, 4326);
  });
  it("marks empty results unavailable and preserves multiple intersecting polygons as ambiguous", () => {
    assert.equal(normalizeGlimRaw(raw([])).lithologyEvidence.status, "no_feature");
    const multiple = normalizeGlimRaw(raw([feature(attrs, 11), feature({ ...attrs, xx: "vb" }, 12)]));
    assert.equal(multiple.lithologyEvidence.status, "ambiguous");
    assert.equal(multiple.lithologyEvidence.features.length, 2);
    assert.deepEqual(multiple.lithologyEvidence.features.map(f => f.objectId), [11, 12]);
  });
  it("retains missing attributes and source No Data classification without reinterpretation", () => {
    const missing = normalizeGlimRaw(raw([{ attributes: { OBJECTID: 9 } }]));
    assert.equal(missing.lithologyEvidence.status, "incomplete");
    assert.equal(missing.lithologyEvidence.features[0].levels.xx, null);
    const noData = normalizeGlimRaw(raw([feature({ ...attrs, xx: "nd", xx_Description: "No Data" })]));
    assert.equal(noData.lithologyEvidence.status, "no_data_class");
    assert.equal(noData.lithologyEvidence.features[0].descriptions.xx, "No Data");
  });
  it("surfaces ArcGIS errors and stores raw metadata and query provenance", async () => {
    const fields = GLIM_FIELDS.map(name => ({ name }));
    const metadata = { geometryType: "esriGeometryPolygon", capabilities: "Query", supportedSpatialRelationships: ["esriSpatialRelIntersects"], spatialReference: { wkid: 102100, latestWkid: 3857 }, fields, name: "GLiM_Niveau_I", id: 1 };
    const serviceMetadata = { serviceDescription: "The GLiM v1.1 is a compilation of geological maps." };
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input); calls.push({ url, init: init ?? {} });
      const payload = url.endsWith("/FeatureServer?f=pjson") ? serviceMetadata : url.includes("?f=pjson") ? metadata : { features: [feature()], spatialReference: { wkid: 4326 } };
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;
    const result = await queryGlimSite({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { fetcher, retries: 0 });
    assert.equal(calls.length, 3);
    assert.equal(result.sourceMetadata.geometryType, "esriGeometryPolygon");
    assert.equal(JSON.parse(result.rawResponseText).features.length, 1);
    assert.match(calls[2].init.body as string, /inSR=4326/);
    const badFetcher = (async () => new Response(JSON.stringify({ error: { code: 400, message: "bad geometry" } }), { status: 200 })) as typeof fetch;
    await assert.rejects(() => queryGlimSite({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { fetcher: badFetcher, retries: 0 }), /ArcGIS error 400/);
  });
  it("retries transient rate limiting and reports HTTP failures", async () => {
    const fields = GLIM_FIELDS.map(name => ({ name }));
    const metadata = { geometryType: "esriGeometryPolygon", capabilities: "Query", supportedSpatialRelationships: ["esriSpatialRelIntersects"], spatialReference: { wkid: 102100, latestWkid: 3857 }, fields };
    const serviceMetadata = { serviceDescription: "The GLiM v1.1 is a compilation of geological maps." };
    let calls = 0;
    const rateLimited = (async (input: URL | RequestInfo) => {
      calls++;
      if (calls === 1) return new Response("rate limited", { status: 429 });
      const url = String(input);
      const payload = url.endsWith("/FeatureServer?f=pjson") ? serviceMetadata : url.includes("?f=pjson") ? metadata : { features: [] };
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;
    const found = await queryGlimSite({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { fetcher: rateLimited, retries: 1 });
    assert.equal(calls, 4);
    assert.equal(found.featureCount, 0);
    const unavailable = (async () => new Response("service unavailable", { status: 503 })) as typeof fetch;
    await assert.rejects(() => queryGlimSite({ id: "GKC", latitude: 22.8, longitude: 26.2, coordinatesApproximate: true }, { fetcher: unavailable, retries: 0 }), /HTTP 503/);
  });
});
