import { cp, lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const mutableDirectories = [
  "app-runtime",
  "cache/nasa-power",
  "processed/climate/candidates",
  "processed/discovery-runs",
  "processed/comparison-runs",
  "raw/nasa-power",
  "raw/copernicus-dem",
  "raw/glim",
];

async function exists(path) {
  try { return await lstat(path); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

export async function preparePersistentData({ projectRoot = process.cwd(), persistentDataDir = process.env.TERRAMATCH_PERSISTENT_DATA_DIR } = {}) {
  if (!persistentDataDir) return { enabled: false, linkedDirectories: [] };
  if (!isAbsolute(persistentDataDir)) throw new Error("TERRAMATCH_PERSISTENT_DATA_DIR must be an absolute path.");

  const root = resolve(projectRoot);
  const projectData = resolve(root, "data");
  const persistentRoot = resolve(persistentDataDir);
  if (isWithin(projectData, persistentRoot) || isWithin(persistentRoot, projectData)) {
    throw new Error("TERRAMATCH_PERSISTENT_DATA_DIR must be outside the project data tree.");
  }
  await mkdir(persistentRoot, { recursive: true });

  const linkedDirectories = [];
  for (const directory of mutableDirectories) {
    const source = join(projectData, directory);
    const target = join(persistentRoot, directory);
    const sourceStat = await exists(source);
    const targetStat = await exists(target);

    if (sourceStat?.isSymbolicLink()) {
      const currentTarget = resolve(dirname(source), await readlink(source));
      if (currentTarget !== target) throw new Error(`Refusing to replace unexpected data symlink: ${source}`);
      linkedDirectories.push(directory);
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    if (sourceStat?.isDirectory()) {
      if (!targetStat) await cp(source, target, { recursive: true, errorOnExist: true, force: false });
      else await cp(source, target, { recursive: true, errorOnExist: false, force: false });
    } else {
      await mkdir(target, { recursive: true });
    }

    if (sourceStat) await rm(source, { recursive: true, force: true });
    await mkdir(dirname(source), { recursive: true });
    await symlink(target, source, process.platform === "win32" ? "junction" : "dir");
    linkedDirectories.push(directory);
  }

  return { enabled: true, persistentDataDir: persistentRoot, linkedDirectories };
}
