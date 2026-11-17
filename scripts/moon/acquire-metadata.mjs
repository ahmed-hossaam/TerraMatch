import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const args = process.argv.slice(2);
const value = (key) => { const at = args.indexOf(key); return at < 0 ? null : args[at + 1] ?? null; };
const datasetId = value("--dataset-id");
const output = value("--output");
const maxBytes = Number(value("--max-bytes"));
const dryRun = args.includes("--dry-run") || !args.includes("--confirm-network");
if (!datasetId || !output || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
  console.error("Usage: npm run moon:acquire:metadata -- --dataset-id <id> --output <absolute-path-outside-repo> --max-bytes <limit> [--confirm-network] [--dry-run]"); process.exitCode = 2;
} else {
  try {
    const { MOON_DATASETS } = await import("../../dist/src/moon/registry/dataset-registry.js");
    const dataset = MOON_DATASETS.find((item) => item.datasetId === datasetId);
    if (!dataset?.sourceUrl) throw new Error("Dataset has no verified official metadata URL.");
    if (dryRun) console.log(JSON.stringify({ status: "dry_run", datasetId, sourceHost: new URL(dataset.sourceUrl).hostname, outputPathProvided: true, maxBytes }, null, 2));
    else {
      const { acquireBoundedFile, writeAcquisitionManifest } = await import("./bounded-acquisition.mjs");
      const result = await acquireBoundedFile({ url: dataset.sourceUrl, destination: output, maxBytes, repositoryRoot: root, userAgent: "TerraMatch-Moon-metadata/1.0" });
      await writeAcquisitionManifest(`${resolve(output)}.manifest.json`, { schemaVersion: "1.0.0", datasetId, kind: "source_metadata_snapshot", ...result });
      console.log(JSON.stringify({ status: "metadata_snapshot_saved", datasetId, byteSize: result.byteSize, sha256: result.sha256 }, null, 2));
    }
  } catch (error) { console.error(`Metadata acquisition failed safely: ${error.message}`); process.exitCode = 1; }
}
