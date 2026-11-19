import { copyFile, cp, lstat, mkdir, realpath, rm, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DIAGNOSTIC_RUNTIME_INPUTS = [
  "data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv",
  "data/evidence/m2/retrieval-manifest-v1.json",
  "scripts/migration/vercel-seed-manifest.json",
];

export async function packageArtifactDiagnosticInputs({ projectRoot = process.cwd(), outputRoot = resolve(projectRoot, ".vercel/output/functions") } = {}) {
  const serverFunction = resolve(outputRoot, "__server.func");
  const apiFunction = resolve(outputRoot, "api/[...].func");
  const serverRealPath = await realpath(serverFunction);

  try {
    const apiStat = await lstat(apiFunction);
    if (apiStat.isSymbolicLink()) {
      const linkedPath = await realpath(apiFunction);
      if (linkedPath !== serverRealPath) throw new Error("Unexpected Vercel API function link target.");
      await unlink(apiFunction);
      await mkdir(dirname(apiFunction), { recursive: true });
      await cp(serverRealPath, apiFunction, { recursive: true });
    } else if (!apiStat.isDirectory()) {
      throw new Error("Vercel API function output is not a directory.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    throw new Error("Vercel API function output is missing.");
  }

  for (const relativePath of DIAGNOSTIC_RUNTIME_INPUTS) {
    const source = resolve(projectRoot, relativePath);
    const target = resolve(apiFunction, relativePath);
    if (!target.startsWith(`${apiFunction}${sep}`)) throw new Error("Diagnostic runtime input escaped the API function directory.");
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  return DIAGNOSTIC_RUNTIME_INPUTS.map((path) => resolve(apiFunction, path));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await packageArtifactDiagnosticInputs();
  process.stdout.write(`Packaged ${DIAGNOSTIC_RUNTIME_INPUTS.length} read-only diagnostic inputs into the Vercel API function.\n`);
}
