import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function verifyAcquiredProduct({ manifest, filePath, repositoryRoot }) {
  const errors = [];
  if (!isAbsolute(filePath)) return ["Acquired product file path must be absolute."];
  const rel = relative(resolve(repositoryRoot), resolve(filePath));
  if (rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) return ["Raw acquired products must be stored outside the repository."];
  if (typeof manifest?.sourceUrl !== "string" || !/^https:\/\//i.test(manifest.sourceUrl)) errors.push("Acquisition manifest source URL must be HTTPS.");
  if (!Number.isSafeInteger(manifest?.byteSize) || Number(manifest.byteSize) < 0) errors.push("Acquisition manifest byteSize is invalid.");
  if (!/^[a-f0-9]{64}$/i.test(String(manifest?.sha256 ?? ""))) errors.push("Acquisition manifest SHA-256 is invalid.");
  if (errors.length) return errors;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return [...errors, "Acquisition path is not a regular file."];
    const bytes = await readFile(filePath);
    if (bytes.byteLength !== manifest.byteSize) errors.push("Acquired product byte size does not match its manifest.");
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256) errors.push("Acquired product checksum does not match its manifest.");
  } catch (error) { errors.push(`Acquired product file is unavailable (${error?.code ?? "read error"}).`); }
  return errors;
}
