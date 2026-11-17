import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { moonCoordinateToLolaPixel, parseLolaNpy } from "../dist/web/src/moon/lola-sample-reader.js";
import { projectLunarPolarCoordinate, unprojectLunarPolarCoordinate } from "../dist/src/moon/coordinates.js";

test("verified processed LOLA artifact parses with actual dimensions, dtype, and sample mapping", async () => {
  const bytes = await readFile("data/processed/moon/lola/ldem_4_height_m.npy");
  const digest = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  assert.equal(digest, "6D750B3134F9F8272913E70793F3140DC6CE2FD857865BD9F28DD7885123D417");
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const grid = parseLolaNpy(buffer);
  assert.equal(grid.lines, 720);
  assert.equal(grid.samples, 1440);
  assert.equal(grid.values.length, 1_036_800);
  assert.equal(grid.values.constructor, Float32Array);

  const center = moonCoordinateToLolaPixel(0, 0);
  assert.equal(center.row, 360);
  assert.equal(center.column, 720);
  assert.equal(center.centerLongitude, 0.125);
  assert.equal(center.centerLatitude, -0.125);
  assert.ok(Number.isFinite(grid.values[center.index]));
  assert.equal(moonCoordinateToLolaPixel(180, 0).column, 0);
  assert.equal(moonCoordinateToLolaPixel(-180, 0).column, 0);
  assert.equal(moonCoordinateToLolaPixel(0, 90).row, 0);
  assert.equal(moonCoordinateToLolaPixel(0, -90).row, 719);
  assert.throws(() => moonCoordinateToLolaPixel(0, 90.01), /latitude/);
});

test("LOLA NPY parser rejects non-NPY and malformed dimensions", () => {
  assert.throws(() => parseLolaNpy(new ArrayBuffer(32)), /NumPy NPY/);
});

test("generated PNG and sidecar provenance match the API research-preview contract", async () => {
  const [image, metadataText] = await Promise.all([
    readFile("data/processed/moon/lola/ldem_4_relative-height-preview.png"),
    readFile("data/processed/moon/lola/ldem_4_relative-height-preview.json", "utf8"),
  ]);
  const metadata = JSON.parse(metadataText);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(image.length, metadata.output.byteSize);
  assert.equal(createHash("sha256").update(image).digest("hex").toUpperCase(), metadata.output.sha256);
  assert.equal(metadata.output.width, 1440);
  assert.equal(metadata.output.height, 720);
  assert.equal(metadata.scientificStatus.independentPointCrossCheck, false);
  assert.equal(metadata.scientificStatus.scientificallyValidated, false);
  assert.equal(metadata.scientificStatus.deliveryReady, false);
  assert.equal(metadata.scientificStatus.renderableAsValidatedLayer, false);
  assert.equal(metadata.scientificStatus.mapReady, false);
  assert.equal(metadata.coordinateReference.geotiffCrsAssigned, false);
  assert.equal(metadata.display.sourceArrayValuesModified, false);
});

test("north and south polar preview PNGs are the expected generated real-data display artifacts", async () => {
  for (const hemisphere of ["north", "south"]) {
    const prefix = `data/processed/moon/lola/ldem_4_${hemisphere}-polar-preview`;
    const [bytes, text] = await Promise.all([readFile(`${prefix}.png`), readFile(`${prefix}.json`, "utf8")]);
    const metadata = JSON.parse(text);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.byteLength, metadata.output.byteSize);
    assert.equal(createHash("sha256").update(bytes).digest("hex").toUpperCase(), metadata.output.sha256);
    assert.equal(metadata.projection.hemisphere, hemisphere);
    assert.equal(metadata.projection.cutoffLatitudeDegrees, 50);
    assert.equal(metadata.display.sourceValuesModified, false);
    assert.equal(metadata.scientificStatus.scientificallyValidated, false);
    assert.equal(metadata.scientificStatus.mapReady, false);
    assert.equal(metadata.output.width, 700);
    assert.equal(metadata.output.height, 700);
  }
});

test("spherical polar projection round-trips known locations, seams, and poles", () => {
  for (const hemisphere of ["north", "south"]) {
    const sign = hemisphere === "north" ? 1 : -1;
    for (const [longitude, latitude] of [[0, 50 * sign], [90, 70 * sign], [-179.5, 89 * sign], [180, 55 * sign]]) {
      const projected = projectLunarPolarCoordinate({ longitude, latitude }, hemisphere);
      const recovered = unprojectLunarPolarCoordinate(projected, hemisphere);
      const lonDiff = ((recovered.longitude - longitude + 540) % 360) - 180;
      assert.ok(Math.abs(lonDiff) < 1e-9, `${hemisphere} longitude ${longitude} round-trips`);
      assert.ok(Math.abs(recovered.latitude - latitude) < 1e-9, `${hemisphere} latitude ${latitude} round-trips`);
    }
    const pole = unprojectLunarPolarCoordinate({ x: 0, y: 0 }, hemisphere);
    assert.equal(pole.longitude, 0);
    assert.equal(pole.latitude, 90 * sign);
  }
  assert.throws(() => projectLunarPolarCoordinate({ longitude: 0, latitude: -20 }, "north"), /outside/);
  assert.throws(() => projectLunarPolarCoordinate({ longitude: 0, latitude: 91 }, "north"), /latitude/);
  assert.throws(() => projectLunarPolarCoordinate({ longitude: Number.NaN, latitude: 60 }, "north"), /finite/);
});
