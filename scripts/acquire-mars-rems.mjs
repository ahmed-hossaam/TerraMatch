import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRemsAirTemperatureArtifact, marsSolarLongitudeDegrees, REMS_EXTRACTION_VERSION, validateRemsAirTemperatureArtifact } from "../dist/src/mars/rems.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/DATA/";
const rawRoot = resolve(process.env.TERRAMATCH_REMS_RAW_DIR || join(tmpdir(), "terramatch-rems-pds-raw-v1"));
const outputPath = resolve(process.env.TERRAMATCH_REMS_OUTPUT || join(root, "data/processed/mars/rems-air-temperature-v1.json"));
const rawRelative = relative(root, rawRoot);
const rawPathIsInsideRepository = rawRelative === "" || (!isAbsolute(rawRelative) && !rawRelative.startsWith(`..${sep}`) && rawRelative !== "..");
if (rawPathIsInsideRepository) throw new Error("REMS raw source files must be stored outside the repository. Set TERRAMATCH_REMS_RAW_DIR to a system-temp location.");
const overwrite = process.argv.includes("--overwrite");
if (!overwrite) { try { await stat(outputPath); throw new Error(`Refusing to overwrite existing derived artifact: ${outputPath}. Pass --overwrite only after reviewing it.`); } catch (error) { if (error?.code !== "ENOENT") throw error; } }

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function htmlLinks(html) { return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1].replaceAll("&amp;", "&")); }
async function get(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "TerraMatch-REMS-reproducible-acquisition/1.0 (research prototype)" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) return { status: response.status, bytes: null };
      return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) { lastError = error; if (attempt < 2) await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1))); }
  }
  throw new Error(`PDS request failed after 3 attempts (${new URL(url).pathname}); ${lastError?.name ?? "network error"}.`);
}

function plannedSols() {
  const start = Date.parse("2012-08-07T04:04:38.536Z");
  const rows = [];
  let marsYearIndex = 0; let previousLs = null;
  // The archive page documents coverage through sol 4488. A nominal sol duration is
  // used only to choose seasonally stratified candidate sols; actual per-product UTC
  // labels determine the Ls used in the final extraction.
  for (let sol = 1; sol <= 4488; sol++) {
    const ls = marsSolarLongitudeDegrees(new Date(start + (sol - 1) * 88775.244 * 1000));
    if (previousLs !== null && previousLs - ls > 180) marsYearIndex++;
    rows.push({ sol, ls, marsYearIndex, bin: Math.floor(ls / 30) });
    previousLs = ls;
  }
  const middleMissionYear = Math.floor(Math.max(...rows.map((row) => row.marsYearIndex)) / 2);
  const groups = new Map();
  for (const row of rows.filter((item) => item.marsYearIndex === middleMissionYear)) groups.set(row.bin, [...(groups.get(row.bin) ?? []), row]);
  return [...groups.values()].map((group) => group[Math.floor(group.length / 2)]).sort((a, b) => a.sol - b.sol).map((row) => row.sol);
}

const sols = plannedSols();
const rangesResponse = await get(baseUrl);
if (!rangesResponse.bytes) throw new Error(`PDS data-volume listing returned HTTP ${rangesResponse.status}.`);
const rootHtml = new TextDecoder().decode(rangesResponse.bytes);
const rangeNames = htmlLinks(rootHtml).map((href) => basename(href.replace(/\/$/, ""))).filter((name) => /^SOL_\d{5}_\d{5}$/.test(name));
const ranges = rangeNames.map((name) => ({ name, start: Number(name.slice(4, 9)), end: Number(name.slice(10, 15)) }));
if (!ranges.length) throw new Error("PDS volume listing did not expose expected sol directory ranges.");
const selected = sols.map((sol) => ({ sol, range: ranges.find((range) => sol >= range.start && sol <= range.end) })).filter((item) => item.range);
const noProductSolIds = sols.filter((sol) => !selected.some((item) => item.sol === sol));
const noProductDetails = new Map(noProductSolIds.map((sol) => [sol, { sol, reason: "target_sol_outside_listed_volume_ranges", httpStatus: null }]));
const groupListings = new Map();
const rangesToList = [...new Set(selected.map((item) => item.range.name))];
for (let index = 0; index < rangesToList.length; index += 8) {
  await Promise.all(rangesToList.slice(index, index + 8).map(async (range) => {
    const response = await get(`${baseUrl}${range}/`);
    if (!response.bytes) throw new Error(`PDS range listing returned HTTP ${response.status} for range ${range}.`);
    groupListings.set(range, new Set(htmlLinks(new TextDecoder().decode(response.bytes)).map((href) => basename(href.replace(/\/$/, ""))).filter((name) => /^SOL\d{5}$/.test(name))));
  }));
}
await mkdir(rawRoot, { recursive: true });
const products = []; const missingProducts = new Set(noProductSolIds);
function markNoProduct(sol, reason, httpStatus = null) { missingProducts.add(sol); noProductDetails.set(sol, { sol, reason, httpStatus }); }
let nextIndex = 0; const workerCount = 4;
async function acquireSol(item) {
  const { sol, range } = item; const solDirectory = `SOL${String(sol).padStart(5, "0")}`;
  if (!groupListings.get(range.name)?.has(solDirectory)) { markNoProduct(sol, "sol_directory_not_listed_in_source_parent"); return; }
  const directoryUrl = `${baseUrl}${range.name}/${solDirectory}/`;
  const listing = await get(directoryUrl);
  if (!listing.bytes) { if (listing.status === 404) { markNoProduct(sol, "sol_directory_http_404", listing.status); return; } throw new Error(`PDS sol listing returned HTTP ${listing.status} for sol ${sol}.`); }
  const productFiles = htmlLinks(new TextDecoder().decode(listing.bytes)).map((href) => basename(href)).filter((name) => /^RME_.*RMD.*\.TAB$/i.test(name)).sort();
  if (!productFiles.length) { markNoProduct(sol, "no_matching_modrdr_table_in_listed_sol_directory"); return; }
  for (const tabName of productFiles) {
    const productUrl = `${directoryUrl}${tabName}`; const labelName = tabName.replace(/\.TAB$/i, ".xml"); const labelUrl = `${directoryUrl}${labelName}`;
    const cacheKey = `sol-${String(sol).padStart(5, "0")}-${tabName.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    const tabPath = join(rawRoot, `${cacheKey}.tab`); const labelPath = join(rawRoot, `${cacheKey}.xml`); const metadataPath = join(rawRoot, `${cacheKey}.json`);
    let metadata; let tabBytes; let labelBytes;
    try {
      metadata = JSON.parse(await readFile(metadataPath, "utf8")); tabBytes = new Uint8Array(await readFile(tabPath)); labelBytes = new Uint8Array(await readFile(labelPath));
      if (sha256(tabBytes) !== metadata.sourceSha256 || sha256(labelBytes) !== metadata.labelSha256 || metadata.productUrl !== productUrl) throw new Error("cached checksum or URL mismatch");
    } catch {
      const [tabResult, labelResult] = await Promise.all([get(productUrl), get(labelUrl)]);
      if (!tabResult.bytes) throw new Error(`PDS MODRDR table returned HTTP ${tabResult.status} for sol ${sol}.`);
      if (!labelResult.bytes) throw new Error(`PDS PDS4 product label returned HTTP ${labelResult.status} for sol ${sol}.`);
      tabBytes = tabResult.bytes; labelBytes = labelResult.bytes;
      metadata = { sol, productUrl, labelUrl, retrievedAt: new Date().toISOString(), sourceSha256: sha256(tabBytes), labelSha256: sha256(labelBytes) };
      await Promise.all([writeFile(tabPath, tabBytes), writeFile(labelPath, labelBytes), writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)]);
    }
    products.push({ sol, sourceProductId: tabName.replace(/\.TAB$/i, ""), productUrl, tab: new TextDecoder().decode(tabBytes), labelXml: new TextDecoder().decode(labelBytes), sourceSha256: metadata.sourceSha256, labelSha256: metadata.labelSha256, retrievedAt: metadata.retrievedAt });
  }
}
async function worker() { while (true) { const index = nextIndex++; if (index >= selected.length) return; await acquireSol(selected[index]); } }
console.log(`Retrieving ${selected.length} seasonally stratified sol products from the official PDS volume; raw files stay outside the repository.`);
await Promise.all(Array.from({ length: workerCount }, worker));
if (!products.length) throw new Error("No MODRDR products were retrieved; no derived artifact was written.");

const known = JSON.parse(await readFile(join(root, "data/processed/climate/known-sites-daily.json"), "utf8"));
const ids = ["GKC", "GKB", "WDE", "KHA", "RTI", "DALL", "DAL", "AHS-GH"];
const powerHistories = Object.fromEntries(ids.map((id) => {
  const history = known.find((entry) => entry.locationId === id);
  if (history) return [id, history];
  return [id, null];
}));
for (const id of ids) if (!powerHistories[id]) powerHistories[id] = JSON.parse(await readFile(join(root, `data/processed/supplementary-evidence/${id}-climate.json`), "utf8"));
const profile = JSON.parse(await readFile(join(root, "data/mission-profiles/mars-surface-v1.json"), "utf8"));
const artifact = buildRemsAirTemperatureArtifact({ sourceProducts: products, retrievedAt: new Date().toISOString(), powerHistories, expectedPowerSiteIds: ids, marsMissionProfile: profile, plannedSolIds: sols, noProductSolIds: [...missingProducts].sort((a, b) => a - b), noProductSolDetails: [...noProductDetails.values()].sort((a, b) => a.sol - b.sol) });
artifact.provenance.retrievalRecords = products.map((source) => ({ sol: source.sol, productId: source.sourceProductId, productUrl: source.productUrl, retrievedAt: source.retrievedAt, sourceSha256: source.sourceSha256, labelSha256: source.labelSha256 }));
artifact.coverage.sourceProductCount = products.length;
artifact.coverage.noProductSolIds = [...missingProducts].sort((a, b) => a - b);
artifact.coverage.noProductSolDetails = [...noProductDetails.values()].sort((a, b) => a.sol - b.sol);
const errors = validateRemsAirTemperatureArtifact(artifact, ids);
if (errors.length) throw new Error(`Derived REMS artifact validation failed: ${errors.join("; ")}`);
await mkdir(dirname(outputPath), { recursive: true });
const temporary = `${outputPath}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
await (await import("node:fs/promises")).rename(temporary, outputPath);
console.log(JSON.stringify({ status: artifact.status, outputPath, outputBytes: (await stat(outputPath)).size, rawDirectoryOutsideRepository: rawRoot, plannedSolCount: sols.length, acquiredSolCount: artifact.coverage.selectedSolCount, sourceProductCount: products.length, missingProductSolCount: missingProducts.size, sourceRecordCount: artifact.coverage.sourceRecordCount, validSampleCount: artifact.qualityControl.validSampleCount, rejectedSampleCount: artifact.qualityControl.rejectedSampleCount, lsBinsWithValidSamples: artifact.coverage.lsBinsWithValidSamples }, null, 2));
