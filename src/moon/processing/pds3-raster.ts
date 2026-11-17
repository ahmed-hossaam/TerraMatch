/** Minimal, deterministic PDS3 detached IMAGE-label reader. It does not decode raster pixels. */
export interface Pds3ImageDescription {
  datasetId: string | null;
  productId: string | null;
  productVersion: string | null;
  target: string | null;
  lines: number | null;
  lineSamples: number | null;
  sampleBits: number | null;
  sampleType: string | null;
  unit: string | null;
  scaleFactor: number | null;
  offset: number | null;
  projection: string | null;
  referenceRadiusKm: number | null;
  latitudeType: "planetocentric" | "planetographic" | null;
  mapResolutionPixelsPerDegree: number | null;
  lineProjectionOffset: number | null;
  sampleProjectionOffset: number | null;
  longitudeDirection: string | null;
  longitudeDomain: { west: number; east: number } | null;
  latitudeDomain: { minimum: number; maximum: number } | null;
  coordinateSystem: string | null;
  pixelRegistration: string | null;
  sourceLabel: "PDS3";
  limitations: string[];
}

function textField(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(?:"([^"]*)"|([^\\r\\n/]+))`, "im"));
  return (match?.[1] ?? match?.[2] ?? null)?.trim() ?? null;
}
function numberField(text: string, key: string): number | null {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)`, "im"));
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function inspectPds3ImageLabel(text: string): Pds3ImageDescription {
  if (!/^\s*PDS_VERSION_ID\s*=\s*["']?PDS3/im.test(text)) throw new Error("Expected a PDS3 detached label.");
  const projection = textField(text, "MAP_PROJECTION_TYPE");
  const radius = numberField(text, "A_AXIS_RADIUS");
  const longitudeWest = numberField(text, "WESTERNMOST_LONGITUDE");
  const longitudeEast = numberField(text, "EASTERNMOST_LONGITUDE");
  const latitudeMin = numberField(text, "MINIMUM_LATITUDE");
  const latitudeMax = numberField(text, "MAXIMUM_LATITUDE");
  const latitudeTypeValue = textField(text, "LATITUDE_TYPE")?.toLowerCase() ?? null;
  const limitations = ["Label inspection is not raster decoding, pixel validation, quality filtering, or proof of valid geographic coverage."];
  if (textField(text, "SCALING_FACTOR") === null || textField(text, "OFFSET") === null) limitations.push("Scale factor or offset is missing; physical values must not be derived.");
  if (!textField(text, "MISSING_CONSTANT") && !textField(text, "MISSING_VALUE")) limitations.push("NoData/fill encoding was not established by this label inspection.");
  if (!projection || radius === null || longitudeWest === null || longitudeEast === null || latitudeMin === null || latitudeMax === null) limitations.push("Projection or spatial bounds are incomplete.");
  return {
    datasetId: textField(text, "DATA_SET_ID"), productId: textField(text, "PRODUCT_ID"), productVersion: textField(text, "PRODUCT_VERSION_ID"), target: textField(text, "TARGET_NAME"),
    lines: numberField(text, "LINES"), lineSamples: numberField(text, "LINE_SAMPLES"), sampleBits: numberField(text, "SAMPLE_BITS"), sampleType: textField(text, "SAMPLE_TYPE"),
    unit: textField(text, "UNIT"), scaleFactor: numberField(text, "SCALING_FACTOR"), offset: numberField(text, "OFFSET"), projection,
    referenceRadiusKm: radius, longitudeDirection: textField(text, "POSITIVE_LONGITUDE_DIRECTION"),
    latitudeType: latitudeTypeValue === "planetocentric" || latitudeTypeValue === "planetographic" ? latitudeTypeValue : null,
    mapResolutionPixelsPerDegree: numberField(text, "MAP_RESOLUTION"), lineProjectionOffset: numberField(text, "LINE_PROJECTION_OFFSET"), sampleProjectionOffset: numberField(text, "SAMPLE_PROJECTION_OFFSET"),
    longitudeDomain: longitudeWest !== null && longitudeEast !== null ? { west: longitudeWest, east: longitudeEast } : null,
    latitudeDomain: latitudeMin !== null && latitudeMax !== null ? { minimum: latitudeMin, maximum: latitudeMax } : null,
    coordinateSystem: textField(text, "COORDINATE_SYSTEM_NAME"), pixelRegistration: textField(text, "PIXEL_REGISTRATION_TYPE"), sourceLabel: "PDS3", limitations,
  };
}

export interface Jp2CodestreamDescription {
  signatureValid: boolean;
  fileFormat: "JP2";
  width: number;
  height: number;
  componentCount: number;
  components: Array<{ precisionBits: number; signed: boolean; horizontalSubsampling: number; verticalSubsampling: number }>;
  tileWidth: number;
  tileHeight: number;
  codestreamBytes: number;
  limitations: string[];
}

/** Reads JP2 container and JPEG2000 SIZ metadata only; it does not decode pixels. */
export function inspectJp2Codestream(input: Uint8Array): Jp2CodestreamDescription {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const readU32 = (offset: number) => view.getUint32(offset, false);
  const readU16 = (offset: number) => view.getUint16(offset, false);
  const readU64 = (offset: number) => Number(view.getBigUint64(offset, false));
  const ascii = (start: number, end: number) => String.fromCharCode(...input.subarray(start, end));
  if (input.length < 12 || ascii(4, 8) !== "jP  " || readU32(0) !== 12 || readU32(8) !== 0x0d0a870a) throw new Error("Invalid JPEG 2000 JP2 signature box.");
  let codestream: { offset: number; size: number } | null = null;
  for (let offset = 0; offset + 8 <= input.length;) {
    let size = readU32(offset);
    const type = ascii(offset + 4, offset + 8);
    let header = 8;
    if (size === 1) { if (offset + 16 > input.length) throw new Error("Truncated JP2 extended box header."); size = readU64(offset + 8); header = 16; }
    else if (size === 0) size = input.length - offset;
    if (!Number.isSafeInteger(size) || size < header || offset + size > input.length) throw new Error("Invalid or truncated JP2 box.");
    if (type === "jp2c") codestream = { offset: offset + header, size: size - header };
    offset += size;
  }
  if (!codestream) throw new Error("JP2 codestream box is missing.");
  const end = codestream.offset + codestream.size;
  let markerOffset = codestream.offset;
  if (input[markerOffset] === 0xff && input[markerOffset + 1] === 0x4f) markerOffset += 2;
  let siz: Jp2CodestreamDescription | null = null;
  while (markerOffset + 4 <= end) {
    if (input[markerOffset] !== 0xff) { markerOffset++; continue; }
    const marker = readU16(markerOffset);
    const segmentLength = readU16(markerOffset + 2);
    if (segmentLength < 2 || markerOffset + 2 + segmentLength > end) throw new Error("Invalid JPEG2000 codestream marker length.");
    if (marker === 0xff51) {
      const q = markerOffset + 4;
      if (segmentLength < 38) throw new Error("JPEG2000 SIZ marker is too short.");
      const componentCount = readU16(q + 34);
      if (segmentLength !== 38 + componentCount * 3) throw new Error("JPEG2000 SIZ component table length is inconsistent.");
      const xSize = readU32(q + 2), ySize = readU32(q + 6), xOrigin = readU32(q + 10), yOrigin = readU32(q + 14);
      const components = Array.from({ length: componentCount }, (_, index) => {
        const position = q + 36 + index * 3, sampleInfo = input[position];
        return { precisionBits: (sampleInfo & 0x7f) + 1, signed: (sampleInfo & 0x80) !== 0, horizontalSubsampling: input[position + 1], verticalSubsampling: input[position + 2] };
      });
      siz = { signatureValid: true, fileFormat: "JP2", width: xSize - xOrigin, height: ySize - yOrigin, componentCount, components, tileWidth: readU32(q + 18), tileHeight: readU32(q + 22), codestreamBytes: codestream.size, limitations: ["Header-only inspection; no pixel decoding, decompression, statistics, orientation check, NoData analysis, or coverage calculation has been performed."] };
      break;
    }
    markerOffset += 2 + segmentLength;
  }
  if (!siz) throw new Error("JPEG2000 codestream has no parseable SIZ marker.");
  return siz;
}

/** Apply only explicitly supplied scale/offset/fill and quality rules; null remains missing. */
export function transformRasterSamples(input: { values: readonly (number | null)[]; scaleFactor: number; offset: number; fillValue: number | null; qualityMask?: readonly boolean[] }): Array<number | null> {
  const { values, scaleFactor, offset, fillValue, qualityMask } = input;
  if (!Number.isFinite(scaleFactor) || !Number.isFinite(offset)) throw new Error("Scale factor and offset must be finite and explicit.");
  if (qualityMask && qualityMask.length !== values.length) throw new Error("Quality mask length must match the sample array.");
  return values.map((value, index) => {
    if (value === null || (fillValue !== null && value === fillValue) || qualityMask?.[index] === false) return null;
    if (!Number.isFinite(value)) throw new Error("Raster samples must be finite numbers or null.");
    return value * scaleFactor + offset;
  });
}

/** Coverage of a supplied finite raster sample window only; it is not global lunar coverage. */
export function summarizeRasterWindow(values: readonly (number | null)[]): { sampleCount: number; validCount: number; missingCount: number; validFraction: number | null; scope: "provided_sample_window" } {
  const validCount = values.filter((value) => value !== null).length;
  const sampleCount = values.length;
  return { sampleCount, validCount, missingCount: sampleCount - validCount, validFraction: sampleCount ? validCount / sampleCount : null, scope: "provided_sample_window" };
}
