import { copyFile, cp, lstat, mkdir, realpath, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DIAGNOSTIC_RUNTIME_INPUTS = [
  "data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv",
  "data/evidence/m2/retrieval-manifest-v1.json",
  "scripts/migration/vercel-seed-manifest.json",
];
export const VERCEL_FUNCTION_ALIASES = [
  "api/[...].func",
  ".well-known/workflow/v1/webhook/[token].func",
];

export async function packageArtifactDiagnosticInputs({ projectRoot = process.cwd(), outputRoot = resolve(projectRoot, ".vercel/output/functions") } = {}) {
  const serverFunction = resolve(outputRoot, "__server.func");
  const serverRealPath = await realpath(serverFunction);

  for (const alias of VERCEL_FUNCTION_ALIASES) {
    const functionPath = resolve(outputRoot, alias);
    try {
      const functionStat = await lstat(functionPath);
      if (functionStat.isSymbolicLink()) {
        const linkedPath = await realpath(functionPath);
        if (linkedPath !== serverRealPath) throw new Error(`Unexpected Vercel function link target: ${alias}`);
        await unlink(functionPath);
        await mkdir(dirname(functionPath), { recursive: true });
        await cp(serverRealPath, functionPath, { recursive: true });
      } else if (!functionStat.isDirectory()) {
        throw new Error(`Vercel function output is not a directory: ${alias}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      throw new Error(`Vercel function output is missing: ${alias}`);
    }
  }

  const apiFunction = resolve(outputRoot, VERCEL_FUNCTION_ALIASES[0]);
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
