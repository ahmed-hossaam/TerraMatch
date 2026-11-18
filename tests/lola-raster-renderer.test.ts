import test from "node:test";
import assert from "node:assert/strict";
import { renderLolaPolarRgba, renderLolaRgba } from "../web/src/moon/lola-raster-renderer.js";
import { moonCoordinateToLolaPixel } from "../web/src/moon/lola-sample-reader.js";
import type { LolaGrid } from "../web/src/moon/lola-sample-reader.js";

const blankGrid = (): LolaGrid => ({ values: new Float32Array(720 * 1440).fill(Number.NaN), lines: 720, samples: 1440 });
const palette = [{ fraction: 0, rgb: [0, 0, 0] }, { fraction: 1, rgb: [200, 100, 50] }];

test("equirectangular raster samples real grid indices at wrapped east-positive coordinates and leaves NaN transparent", () => {
  const grid = blankGrid();
  grid.values[moonCoordinateToLolaPixel(-90, 45).index] = 0;
  grid.values[moonCoordinateToLolaPixel(90, -45).index] = 10;
  const rgba = renderLolaRgba(grid, 2, 2, [0, 10], palette);
  assert.deepEqual([...rgba.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...rgba.slice(4, 8)], [0, 0, 0, 0]);
  assert.deepEqual([...rgba.slice(8, 12)], [0, 0, 0, 0]);
  assert.deepEqual([...rgba.slice(12, 16)], [200, 100, 50, 255]);
});

test("polar derivative is inverse-projected from LOLA pixels and masks projected area outside the cap", () => {
  const grid = blankGrid(); grid.values.fill(250);
  const rgba = renderLolaPolarRgba(grid, "north", 40, 100_000, 1_737_400, 50, [0, 500], palette);
  assert.equal(rgba[(20 * 40 + 20) * 4 + 3], 255);
  assert.equal(rgba[3], 0);
});
