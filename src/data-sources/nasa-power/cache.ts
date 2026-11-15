import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { NASA_POWER_ENDPOINT } from "./config.js";
import type { DailyRequest } from "./request.js";

export interface CacheEnvelope { cacheKey: string; responseText: string; retrievedAt: string; }
export interface RawMetadata { sourceId: string; provider: string; endpoint: string; sourceUrl: string; retrievedAt: string; requestParameters: Record<string, string>; locationId: string; coordinatesApproximate: boolean | null; }
export function makeCacheKey(request: DailyRequest): string {
  const canonical = JSON.stringify({ endpoint: NASA_POWER_ENDPOINT, latitude: request.latitude, longitude: request.longitude, start: request.start, end: request.end, parameters: [...(request.parameters ?? [])].sort(), community: "AG", format: "JSON", timeStandard: "UTC" });
  return createHash("sha256").update(canonical).digest("hex");
}
async function writeAtomic(path: string, data: string) {
  await mkdir(path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))), { recursive: true });
  const temporary = `${path}.${process.pid ?? "p"}.tmp`;
  await writeFile(temporary, data, "utf8");
  await rename(temporary, path);
}
export class NasaPowerStorage {
  constructor(readonly cacheDirectory = "data/cache/nasa-power", readonly rawDirectory = "data/raw/nasa-power") {}
  private cachePath(cacheKey: string) { return `${this.cacheDirectory}/${cacheKey}.json`; }
  async readCache(cacheKey: string): Promise<CacheEnvelope | null> {
    try {
      const parsed = JSON.parse(await readFile(this.cachePath(cacheKey), "utf8")) as CacheEnvelope;
      if (parsed.cacheKey !== cacheKey || typeof parsed.responseText !== "string" || typeof parsed.retrievedAt !== "string") return null;
      return parsed;
    } catch { return null; }
  }
  async writeCache(entry: CacheEnvelope): Promise<void> {
    await writeAtomic(this.cachePath(entry.cacheKey), JSON.stringify(entry) + "\n");
  }
  async preserveRaw(args: { responseText: string; cacheKey: string; metadata: RawMetadata }): Promise<{ rawPath: string; metadataPath: string }> {
    const safeId = args.metadata.locationId.replace(/[^A-Za-z0-9_-]/g, "_");
    const yearRange = `${args.metadata.requestParameters.start.slice(0,4)}-${args.metadata.requestParameters.end.slice(0,4)}`;
    const basename = `${safeId}_${yearRange}_${args.cacheKey.slice(0,12)}`;
    const rawPath = `${this.rawDirectory}/${basename}.json`;
    const metadataPath = `${this.rawDirectory}/${basename}.meta.json`;
    await writeAtomic(rawPath, args.responseText);
    await writeAtomic(metadataPath, JSON.stringify(args.metadata, null, 2) + "\n");
    return { rawPath, metadataPath };
  }
}
