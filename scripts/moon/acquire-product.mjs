import { resolve, isAbsolute, relative, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { acquireBoundedFile, writeAcquisitionManifest } from "./bounded-acquisition.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const args = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] ?? null; }
function fail(message) { console.error(message); process.exitCode = 2; }
const datasetId = option("--dataset-id");
const url = option("--url");
const outputValue = option("--output");
const maxBytes = Number(option("--max-bytes"));
const expectedSha256 = option("--sha256");
const dryRun = args.includes("--dry-run");
if (!datasetId || !url || !outputValue || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
  fail("Usage: node scripts/moon/acquire-product.mjs --dataset-id <id> --url <official-file-url> --output <absolute-path-outside-repo> --max-bytes <limit> [--sha256 <expected-sha256>] [--dry-run]");
} else {
  try {
    const { MOON_DATASETS } = await import("../../dist/src/moon/registry/dataset-registry.js");
    const dataset = MOON_DATASETS.find((item) => item.datasetId === datasetId);
    if (!dataset) throw new Error(`Unknown registered dataset ID: ${datasetId}`);
    const requested = new URL(url);
    const registered = dataset.downloadUrl ? new URL(dataset.downloadUrl) : null;
    if (!registered || requested.protocol !== "https:" || requested.href !== registered.href) throw new Error("Download URL must exactly match the registered official product endpoint.");
    const output = resolve(outputValue);
    const rel = relative(root, output);
    if (rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) throw new Error("Output must be outside the repository.");
    if (dryRun) {
      console.log(JSON.stringify({ status: "dry_run", datasetId, sourceHost: requested.hostname, outputPathProvided: true, maxBytes }, null, 2));
    } else {
      const result = await acquireBoundedFile({ url, destination: output, maxBytes, expectedSha256, repositoryRoot: root });
      const manifest = { schemaVersion: "1.0.0", datasetId, acquisitionAdapterId: "moon-bounded-http-v1", ...result };
      const manifestPath = `${output}.manifest.json`;
      await writeAcquisitionManifest(manifestPath, manifest);
      console.log(JSON.stringify({ status: result.reused ? "verified_existing" : "acquired", datasetId, byteSize: result.byteSize, sha256: result.sha256, contentType: result.contentType, manifestWritten: true }, null, 2));
    }
  } catch (error) { fail(`Moon acquisition failed safely: ${error.message}`); }
}
