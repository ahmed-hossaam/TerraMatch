import test from "node:test";
import assert from "node:assert/strict";
import { inspectJp2Codestream, inspectPds3ImageLabel, summarizeRasterWindow, transformRasterSamples } from "../src/moon/processing/pds3-raster.js";

// Synthetic parser fixture based on documented PDS fields; not a downloaded product.
const fixtureLabel = `PDS_VERSION_ID = "PDS3"\nDATA_SET_ID = "LRO-L-LOLA-4-GDR-V1.0"\nPRODUCT_ID = "LDEM_4"\nPRODUCT_VERSION_ID = "V3.0"\nTARGET_NAME = MOON\nLINES = 720\nLINE_SAMPLES = 1440\nSAMPLE_BITS = 16\nSAMPLE_TYPE = LSB_INTEGER\nUNIT = METER\nSCALING_FACTOR = 0.5\nOFFSET = 1737400.\nMAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"\nMAP_RESOLUTION = 4 <pix/deg>\nA_AXIS_RADIUS = 1737.4 <km>\nPOSITIVE_LONGITUDE_DIRECTION = "EAST"\nWESTERNMOST_LONGITUDE = -180 <deg>\nEASTERNMOST_LONGITUDE = 180 <deg>\nMINIMUM_LATITUDE = -90 <deg>\nMAXIMUM_LATITUDE = 90 <deg>\nLINE_PROJECTION_OFFSET = 359.5 <pix>\nSAMPLE_PROJECTION_OFFSET = 719.5 <pix>\nCOORDINATE_SYSTEM_NAME = "MEAN EARTH/POLAR AXIS OF DE421"\nPIXEL_REGISTRATION_TYPE = "PIXEL REGISTERED"\nEND`;

test("PDS3 label parser handles units while leaving absent latitude and NoData metadata unknown", () => {
  const result = inspectPds3ImageLabel(fixtureLabel);
  assert.equal(result.productId, "LDEM_4");
  assert.equal(result.productVersion, "V3.0");
  assert.deepEqual([result.lines, result.lineSamples, result.sampleBits], [720, 1440, 16]);
  assert.equal(result.sampleType, "LSB_INTEGER");
  assert.equal(result.scaleFactor, 0.5);
  assert.equal(result.offset, 1737400);
  assert.equal(result.referenceRadiusKm, 1737.4);
  assert.ok(result.latitudeType === null, "latitude type must not be inferred from projection");
  assert.equal(result.mapResolutionPixelsPerDegree, 4);
  assert.deepEqual([result.lineProjectionOffset, result.sampleProjectionOffset], [359.5, 719.5]);
  assert.deepEqual(result.longitudeDomain, { west: -180, east: 180 });
  assert.ok(result.limitations.some((item) => item.includes("not raster decoding")));
  assert.ok(result.limitations.some((item) => item.includes("NoData/fill")));
  assert.throws(() => inspectPds3ImageLabel("not a label"), /PDS3/);
});

function box(type: string, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(8 + payload.length), view = new DataView(result.buffer);
  view.setUint32(0, result.length, false); result.set(new TextEncoder().encode(type), 4); result.set(payload, 8); return result;
}
function syntheticJp2(): Uint8Array {
  const signature = Uint8Array.from([0,0,0,12,0x6a,0x50,0x20,0x20,0x0d,0x0a,0x87,0x0a]);
  const siz = new Uint8Array(43), v = new DataView(siz.buffer);
  v.setUint16(0, 0xff51, false); v.setUint16(2, 41, false);
  v.setUint32(6, 1440, false); v.setUint32(10, 720, false);
  v.setUint32(22, 1440, false); v.setUint32(26, 720, false); v.setUint16(38, 1, false);
  siz.set([0x8f, 1, 1], 40);
  const codestream = Uint8Array.from([0xff,0x4f,...siz]), jp2c = box("jp2c", codestream);
  const result = new Uint8Array(signature.length + jp2c.length); result.set(signature); result.set(jp2c, signature.length); return result;
}
test("JP2 parser identifies header structure without claiming pixel decoding", () => {
  const inspected = inspectJp2Codestream(syntheticJp2());
  assert.deepEqual([inspected.width, inspected.height, inspected.componentCount], [1440, 720, 1]);
  assert.deepEqual(inspected.components, [{ precisionBits: 16, signed: true, horizontalSubsampling: 1, verticalSubsampling: 1 }]);
  assert.deepEqual([inspected.tileWidth, inspected.tileHeight], [1440, 720]);
  assert.ok(inspected.limitations[0].includes("no pixel decoding"));
  assert.throws(() => inspectJp2Codestream(new Uint8Array([1, 2, 3])), /signature/);
});

test("raster transformation preserves null, explicit fill and rejected quality values", () => {
  assert.deepEqual(transformRasterSamples({ values: [0, 2, -999, null, 3], scaleFactor: 0.5, offset: 10, fillValue: -999, qualityMask: [true, true, true, true, false] }), [10, 11, null, null, null]);
  assert.throws(() => transformRasterSamples({ values: [1, 2], scaleFactor: 1, offset: 0, fillValue: null, qualityMask: [true] }), /length/);
  assert.throws(() => transformRasterSamples({ values: [Number.NaN], scaleFactor: 1, offset: 0, fillValue: null }), /finite/);
});

test("coverage is limited to a supplied window and empty coverage remains null", () => {
  assert.deepEqual(summarizeRasterWindow([1, null, 2, null]), { sampleCount: 4, validCount: 2, missingCount: 2, validFraction: 0.5, scope: "provided_sample_window" });
  assert.deepEqual(summarizeRasterWindow([]), { sampleCount: 0, validCount: 0, missingCount: 0, validFraction: null, scope: "provided_sample_window" });
});
