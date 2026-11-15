/** Narrow, cache-friendly clients/parsers for the external catalogs assessed in M2.
 * These adapters return source records as received; site association is a separate step.
 */
export type CatalogRetrievalStatus = "retrieved" | "no_match" | "failed" | "unavailable";
export interface CatalogResult<T> { status: CatalogRetrievalStatus; records: T[]; sourceUrl: string; retrievedAt: string | null; error: string | null; rawResponseText?: string; }
const result = <T>(status: CatalogRetrievalStatus, records: T[], sourceUrl: string, error: string | null = null): CatalogResult<T> => ({ status, records, sourceUrl, retrievedAt: status === "retrieved" || status === "no_match" ? new Date().toISOString() : null, error });

/** Persist exact response text once; an existing raw source payload is never overwritten. */
export async function persistRawCatalogPayload(path: string, rawResponseText: string): Promise<"written" | "already_present"> {
  try { await access(path); return "already_present"; } catch { /* not present */ }
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separator > 0) await mkdir(path.slice(0, separator), { recursive: true });
  try { await writeFile(path, rawResponseText, { encoding: "utf8", flag: "wx" }); return "written"; }
  catch (error) { if ((error as any)?.code === "EEXIST") return "already_present"; throw error; }
}

/** Read a single, DOI-addressed ScienceBase item (for example the PAAD release). */
export async function retrieveScienceBaseItem(itemId: string, fetcher: typeof fetch = fetch): Promise<CatalogResult<Record<string, unknown>>> {
  const url = `https://www.sciencebase.gov/catalog/item/${encodeURIComponent(itemId)}?format=json`;
  try {
    const response = await fetcher(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return result("failed", [], url, `ScienceBase returned HTTP ${response.status}.`);
    const rawResponseText = await response.text();
    let item: unknown; try { item = JSON.parse(rawResponseText); } catch { return result("failed", [], url, "ScienceBase returned malformed JSON."); }
    if (!item || typeof item !== "object" || Array.isArray(item) || !("id" in item)) return result("failed", [], url, "ScienceBase returned malformed item metadata.");
    return { ...result("retrieved", [item as Record<string, unknown>], url), rawResponseText };
  } catch (error) { return result("unavailable", [], url, error instanceof Error ? error.message : String(error)); }
}

/** Parse an EarthChem PetDB v4 location/sample response without assigning it to a site. */
export function parseEarthChemSamples(payload: unknown, sourceUrl: string): CatalogResult<Record<string, unknown>> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result("failed", [], sourceUrl, "EarthChem response is not an object.");
  const body = payload as Record<string, unknown>;
  const candidates = Array.isArray(body.samples) ? body.samples : Array.isArray(body.records) ? body.records : Array.isArray(body.data) ? body.data : null;
  if (!candidates) return result("failed", [], sourceUrl, "EarthChem response has no documented sample collection field.");
  const records = candidates.filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v));
  if (records.length !== candidates.length) return result("failed", [], sourceUrl, "EarthChem sample collection contains malformed records.");
  return result(records.length ? "retrieved" : "no_match", records, sourceUrl);
}

export async function retrieveEarthChemSamples(url: string, fetcher: typeof fetch = fetch): Promise<CatalogResult<Record<string, unknown>>> {
  try {
    const response = await fetcher(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return result("failed", [], url, `EarthChem returned HTTP ${response.status}.`);
    const rawResponseText = await response.text(); let payload: unknown;
    try { payload = JSON.parse(rawResponseText); } catch { return result("failed", [], url, "EarthChem returned malformed JSON."); }
    return { ...parseEarthChemSamples(payload, url), rawResponseText };
  } catch (error) { return result("unavailable", [], url, error instanceof Error ? error.message : String(error)); }
}

/** GEOROC currently documents query/download files rather than a stable public API.
 * This parser accepts already downloaded CSV text; it never downloads a global compilation.
 */
export function parseGeorocCsv(csv: string, sourceUrl: string): CatalogResult<Record<string, string>> {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return result("failed", [], sourceUrl, "GEOROC CSV is empty.");
  const split = (line: string) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  const headers = split(lines[0]).map((header, index) => ({ header, index })).filter((column) => column.header.length > 0);
  if (!headers.length || !headers.some(({ header }) => /sample|latitude|longitude|reference|analysis/i.test(header))) return result("failed", [], sourceUrl, "GEOROC CSV header lacks recognizable sample/provenance fields.");
  const records = lines.slice(1).map(split).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map(({ header, index }) => [header, row[index] ?? ""])));
  return result(records.length ? "retrieved" : "no_match", records, sourceUrl);
}

/** Parse the published USGS OFR 2024-1062 Table 1. The table reports mount-average
 * pristine-glass major oxides, not single-grain values or mount coordinates.
 */
export interface UsGsReportMeasurement {
  originalRecordId: string;
  tableNumber: "1";
  sampleLabel: string;
  material: string;
  parameter: string;
  value: number;
  unit: "wt%";
  method: "wavelength dispersive spectrometry (WDS)";
}

export function parseUsGsMeteorCraterTable1(html: string): CatalogResult<UsGsReportMeasurement> {
  const anchor = html.indexOf('id="ofr20241062-t01"');
  const tableStart = anchor >= 0 ? html.indexOf("<table", anchor) : -1;
  const tableEnd = tableStart >= 0 ? html.indexOf("</table>", tableStart) : -1;
  if (tableStart < 0 || tableEnd < 0) return result("failed", [], "https://pubs.usgs.gov/publication/ofr20241062/full", "USGS report Table 1 was not found.");
  const table = html.slice(tableStart, tableEnd + 8);
  const clean = (value: string) => value.replace(/<sub[^>]*>/gi, "").replace(/<\/sub>/gi, "").replace(/<sup[^>]*>/gi, "").replace(/<\/sup>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&#8217;|&rsquo;/gi, "’").trim();
  const header = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";
  const mounts = [...header.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => clean(match[1])).filter((name) => /^[A-Z]{1,2}$/.test(name));
  const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  const records: UsGsReportMeasurement[] = [];
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => clean(match[1]));
    if (cells.length !== mounts.length + 1) continue;
    const parameter = cells[0];
    for (let index = 0; index < mounts.length; index++) {
      const value = Number(cells[index + 1]);
      if (!Number.isFinite(value)) return result("failed", [], "https://pubs.usgs.gov/publication/ofr20241062/full", `USGS Table 1 has a non-numeric value for ${parameter}, mount ${mounts[index]}.`);
      records.push({ originalRecordId: `OFR2024-1062:Table1:mount-${mounts[index]}:${parameter}`, tableNumber: "1", sampleLabel: `Mount ${mounts[index]}`, material: "Pristine impact-melt glass; average composition for mount", parameter, value, unit: "wt%", method: "wavelength dispersive spectrometry (WDS)" });
    }
  }
  if (mounts.length !== 15 || records.length !== 195) return result("failed", [], "https://pubs.usgs.gov/publication/ofr20241062/full", `USGS Table 1 yielded ${records.length} observations across ${mounts.length} mounts; expected the published 15 mounts by 13 reported rows.`);
  return result("retrieved", records, "https://pubs.usgs.gov/publication/ofr20241062/full");
}

export async function retrieveGeorocCsv(url: string, fetcher: typeof fetch = fetch, maximumBytes = 20_000_000): Promise<CatalogResult<Record<string, string>>> {
  try {
    const response = await fetcher(url, { headers: { accept: "text/csv,text/plain" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return result("failed", [], url, `GEOROC returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) return result("unavailable", [], url, `GEOROC file exceeds the configured ${maximumBytes}-byte import limit.`);
    if (!response.body) return result("unavailable", [], url, "GEOROC response does not provide a bounded readable stream.");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maximumBytes) { await reader.cancel(); return result("unavailable", [], url, `GEOROC file exceeds the configured ${maximumBytes}-byte import limit.`); } chunks.push(value); } }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const rawResponseText = new TextDecoder().decode(bytes);
    return { ...parseGeorocCsv(rawResponseText, url), rawResponseText };
  } catch (error) { return result("unavailable", [], url, error instanceof Error ? error.message : String(error)); }
}

export interface SiteCoordinate { siteId: string; latitude: number | null; longitude: number | null; }
export function coordinateRelationship(site: SiteCoordinate, record: Record<string, unknown>, radiusKm = 10): "exact" | "nearby" | "regional_or_uncertain" | "unmatched" {
  const fields = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[^a-z]/g, ""), value]));
  const lat = Number(fields.latitude ?? fields.lat), lon = Number(fields.longitude ?? fields.lon ?? fields.longitudedecimal);
  if (site.latitude === null || site.longitude === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return "unmatched";
  const dLat = (lat - site.latitude) * Math.PI / 180, dLon = (lon - site.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(site.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const distanceKm = 6371.0088 * 2 * Math.asin(Math.sqrt(a));
  if (distanceKm < 0.01) return "exact";
  if (distanceKm <= radiusKm) return "nearby";
  if (distanceKm <= 100) return "regional_or_uncertain";
  return "unmatched";
}
import { access, mkdir, writeFile } from "node:fs/promises";
