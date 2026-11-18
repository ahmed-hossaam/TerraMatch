import { moonCoordinateToLolaPixel, type LolaGrid } from "./lola-sample-reader.js";
import { unprojectLunarPolarCoordinate, type PolarHemisphere } from "../../../src/moon/coordinates.js";

export type RgbAnchor = { fraction: number; rgb: number[] };

/** Colorize the actual processed Float32 grid without changing its numeric samples. */
export function renderLolaRgba(grid: LolaGrid, width: number, height: number, range: [number, number], anchors: RgbAnchor[], centerLongitude = 0): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || range[1] <= range[0] || anchors.length < 2) throw new Error("Invalid LOLA display raster parameters.");
  const output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = centerLongitude - 180 + (x + 0.5) / width * 360;
    const latitude = 90 - (y + 0.5) / height * 180;
    const value = grid.values[moonCoordinateToLolaPixel(longitude, latitude).index];
    colorValue(output, (y * width + x) * 4, value, range, anchors);
  }
  return output;
}

/** Inverse-sample the actual grid into a north/south spherical polar stereographic display. */
export function renderLolaPolarRgba(grid: LolaGrid, hemisphere: PolarHemisphere, size: number, pixelSizeM: number, radiusM: number, cutoffLatitude: number, range: [number, number], anchors: RgbAnchor[]): Uint8ClampedArray {
  if (!Number.isInteger(size) || size < 1 || pixelSizeM <= 0 || radiusM <= 0 || cutoffLatitude < 0 || cutoffLatitude >= 90) throw new Error("Invalid lunar polar display parameters.");
  const output = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const projected = { x: (x + 0.5 - size / 2) * pixelSizeM, y: (size / 2 - y - 0.5) * pixelSizeM };
    const geographic = unprojectLunarPolarCoordinate(projected, hemisphere, radiusM);
    const offset = (y * size + x) * 4;
    if (Math.abs(geographic.latitude) < cutoffLatitude) continue;
    colorValue(output, offset, grid.values[moonCoordinateToLolaPixel(geographic.longitude, geographic.latitude).index], range, anchors);
  }
  return output;
}

function colorValue(output: Uint8ClampedArray, offset: number, value: number, range: [number, number], anchors: RgbAnchor[]): void {
  if (!Number.isFinite(value)) return; // NaN/NoData remains transparent.
  const fraction = Math.max(0, Math.min(1, (value - range[0]) / (range[1] - range[0])));
  let upper = anchors.findIndex((anchor) => anchor.fraction >= fraction);
  if (upper <= 0) upper = 1;
  const lower = anchors[upper - 1], high = anchors[upper];
  const blend = Math.max(0, Math.min(1, (fraction - lower.fraction) / (high.fraction - lower.fraction)));
  for (let channel = 0; channel < 3; channel++) output[offset + channel] = Math.round(lower.rgb[channel] + (high.rgb[channel] - lower.rgb[channel]) * blend);
  output[offset + 3] = 255;
}
