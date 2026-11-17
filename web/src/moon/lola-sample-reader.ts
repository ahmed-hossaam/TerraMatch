export interface LolaGrid { readonly values: Float32Array; readonly lines: number; readonly samples: number; }
export interface MoonPixelAddress { readonly row: number; readonly column: number; readonly index: number; readonly centerLatitude: number; readonly centerLongitude: number; }
export type { PolarHemisphere } from "../../../src/moon/coordinates.js";

/** Parse the narrow, verified NumPy v1/v2 little-endian Float32 format used by the processed LDEM_4 artifact. */
export function parseLolaNpy(buffer: ArrayBuffer): LolaGrid {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12 || bytes[0] !== 0x93 || new TextDecoder().decode(bytes.subarray(1, 6)) !== "NUMPY") throw new Error("LOLA grid file is not a NumPy NPY artifact.");
  const major = bytes[6], minor = bytes[7];
  const view = new DataView(buffer);
  let headerLength: number, headerStart: number;
  if (major === 1 && minor === 0) { headerLength = view.getUint16(8, true); headerStart = 10; }
  else if (major === 2 && minor === 0) { if (bytes.length < 12) throw new Error("LOLA NPY v2 header is truncated."); headerLength = view.getUint32(8, true); headerStart = 12; }
  else throw new Error("Unsupported LOLA NPY version; expected v1.0 or v2.0.");
  const dataStart = headerStart + headerLength;
  if (!Number.isSafeInteger(dataStart) || dataStart > bytes.length) throw new Error("LOLA NPY header length is invalid.");
  const header = new TextDecoder("ascii", { fatal: true }).decode(bytes.subarray(headerStart, dataStart));
  const descr = header.match(/['"]descr['"]\s*:\s*['"]([^'"]+)['"]/);
  const fortran = header.match(/['"]fortran_order['"]\s*:\s*(True|False)/);
  const shape = header.match(/['"]shape['"]\s*:\s*\(\s*(\d+)\s*,\s*(\d+)\s*,?\s*\)/);
  if (!descr || !fortran || !shape || Number(shape[1]) !== 720 || Number(shape[2]) !== 1440 || fortran[1] !== "False" || !["<f4", "=f4", "|f4"].includes(descr[1])) {
    throw new Error("LOLA NPY must be a C-order 720x1440 Float32 grid.");
  }
  const lines = Number(shape[1]), samples = Number(shape[2]), count = lines * samples;
  if (bytes.length - dataStart !== count * 4) throw new Error("LOLA NPY sample byte count does not match the declared dimensions.");
  const source = bytes.subarray(dataStart);
  const values = new Float32Array(count);
  const samplesView = new DataView(source.buffer, source.byteOffset, source.byteLength);
  for (let i = 0; i < count; i++) values[i] = samplesView.getFloat32(i * 4, true);
  return { values, lines, samples };
}

/** Return the containing source pixel using product cell boundaries; coordinates use planetocentric lat and east-positive [-180,180]. */
export function moonCoordinateToLolaPixel(longitude: number, latitude: number): MoonPixelAddress {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Moon coordinate must be finite and latitude must be within [-90, 90].");
  const wrappedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const column = Math.min(1439, Math.max(0, Math.floor((wrappedLongitude + 180) * 4)));
  const row = Math.min(719, Math.max(0, Math.floor((90 - latitude) * 4)));
  return { row, column, index: row * 1440 + column, centerLongitude: (column - 719.5) / 4, centerLatitude: (359.5 - row) / 4 };
}
