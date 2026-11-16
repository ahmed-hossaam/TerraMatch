import { access, link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

/** Local development JSON artifact store. Vercel production persistence is
 * handled by a separate durable adapter; this class never implies that function
 * disk writes are durable. */
export class LocalJsonArtifactStore {
  constructor(root) {
    this.root = resolve(root);
    this.writeChains = new Map();
  }

  path(key) {
    if (typeof key !== "string" || !key || isAbsolute(key)) throw new Error("Artifact key must be a non-empty relative path.");
    const target = resolve(this.root, key.replaceAll("/", sep));
    const rel = relative(this.root, target);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error("Artifact key must remain within the configured data root.");
    }
    return target;
  }

  async readJson(key) {
    return JSON.parse(await readFile(this.path(key), "utf8"));
  }

  async readOptionalJson(key) {
    try {
      await access(this.path(key));
      return await this.readJson(key);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async listNames(prefix, pattern = /.*/) {
    const dir = this.path(prefix);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && pattern.test(entry.name)).map((entry) => entry.name).sort().reverse();
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async writeJsonAtomic(key, value) {
    const destination = this.path(key);
    const previous = this.writeChains.get(destination) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      await mkdir(dirname(destination), { recursive: true });
      const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      try {
        await rename(temporary, destination);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      return key;
    });
    this.writeChains.set(destination, operation);
    try {
      return await operation;
    } finally {
      if (this.writeChains.get(destination) === operation) this.writeChains.delete(destination);
    }
  }

  async writeJsonImmutable(key, value) {
    const destination = this.path(key);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    try {
      // Linking the completed temporary file to its final name is atomic and
      // fails if another writer already created the immutable archive key.
      await link(temporary, destination);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error(`Immutable artifact already exists: ${key}`);
      }
      throw error;
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return key;
  }
}
