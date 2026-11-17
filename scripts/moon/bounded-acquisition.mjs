import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

function inside(root, target) {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function safeMetadata(url, response, bytes, digest, retrievedAt) {
  return { schemaVersion: "1.0.0", sourceUrl: url, retrievedAt, contentType: response.headers.get("content-type"), byteSize: bytes, sha256: digest, filename: basename(new URL(url).pathname) || null };
}

/**
 * Bounded, atomic, no-overwrite downloader for raw lunar source products.
 * Resumption is intentionally unsupported: a partial range response is never
 * mistaken for a complete immutable source product.
 */
export async function acquireBoundedFile({ url, destination, maxBytes, expectedSha256 = null, timeoutMs = 30_000, retries = 2, fetchImpl = fetch, repositoryRoot = process.cwd(), userAgent = "TerraMatch-Moon-acquisition/1.0" }) {
  if (!url || new URL(url).protocol !== "https:") throw new Error("Source URL must use HTTPS.");
  if (!destination || !isAbsolute(destination)) throw new Error("An absolute output path is required.");
  if (inside(repositoryRoot, destination)) throw new Error("Raw Moon products must be stored outside the Git repository.");
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("An explicit positive --max-bytes limit is required.");
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) throw new Error("Retries must be between zero and five.");
  if (expectedSha256 && !/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("Expected SHA-256 must be 64 hexadecimal characters.");
  const output = resolve(destination);
  try {
    await access(output);
    if (!expectedSha256) throw new Error("Output already exists; refusing overwrite without an expected source checksum.");
    const oldBytes = await readFile(output);
    const oldDigest = sha256(oldBytes);
    if (oldDigest !== expectedSha256.toLowerCase()) throw new Error("Existing output checksum does not match expected SHA-256; refusing overwrite.");
    return { ...safeMetadata(url, { headers: new Headers() }, oldBytes.byteLength, oldDigest, null), destination: output, reused: true };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.${randomUUID()}.partial`;
  let lastError;
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, { method: "GET", headers: { "user-agent": userAgent, accept: "application/octet-stream, application/xml, text/plain;q=0.9, */*;q=0.5" }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < retries) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * (2 ** attempt))); continue; }
          throw Object.assign(new Error(`Source returned HTTP ${response.status}.`), { status: response.status });
        }
        const declared = Number(response.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`Source Content-Length exceeds the explicit ${maxBytes}-byte limit.`);
        if (!response.body) throw new Error("Source response has no body.");
        let byteSize = 0;
        const hash = createHash("sha256");
        const counter = new Transform({ transform(chunk, _encoding, callback) {
          byteSize += chunk.length;
          if (byteSize > maxBytes) { callback(new Error(`Downloaded content exceeds the explicit ${maxBytes}-byte limit.`)); return; }
          hash.update(chunk); callback(null, chunk);
        } });
        await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(temporary, { flags: "wx" }));
        const digest = hash.digest("hex");
        if (expectedSha256 && digest !== expectedSha256.toLowerCase()) throw new Error("Downloaded content checksum does not match expected SHA-256.");
        await link(temporary, output); // Atomic create-if-absent; never overwrites source data.
        await unlink(temporary);
        return { ...safeMetadata(url, response, byteSize, digest, new Date().toISOString()), destination: output, reused: false };
      } catch (error) {
        lastError = error;
        await unlink(temporary).catch(() => {});
        // Local finalization conflicts and validation failures are not network
        // failures. Retrying them can obscure the immutable no-overwrite rule.
        const nonRetryableCode = new Set(["EEXIST", "EACCES", "EPERM", "ENOSPC"]);
        const nonRetryableMessage = /exceeds|checksum|already exists|refusing overwrite|concurrently created/i.test(String(error?.message ?? ""));
        const retryable = !error?.status && !nonRetryableCode.has(error?.code) && !nonRetryableMessage && attempt < retries;
        if (!retryable) throw error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * (2 ** attempt)));
      }
    }
    throw lastError ?? new Error("Acquisition failed.");
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function writeAcquisitionManifest(manifestPath, metadata) {
  if (!isAbsolute(manifestPath)) throw new Error("Manifest path must be absolute.");
  if (inside(process.cwd(), manifestPath)) throw new Error("Acquisition manifests for raw files must remain outside the repository.");
  const output = resolve(manifestPath);
  await mkdir(dirname(output), { recursive: true });
  const content = `${JSON.stringify(metadata, null, 2)}\n`;
  try {
    const existing = await readFile(output, "utf8");
    if (existing === content) return output;
    throw new Error("Manifest already exists with different content; refusing overwrite.");
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const temporary = `${output}.${process.pid}.${randomUUID()}.partial`;
  await writeFile(temporary, content, { flag: "wx" });
  try { await link(temporary, output); } catch (error) { if (error?.code === "EEXIST") throw new Error("Manifest was concurrently created; inspect it before retrying."); throw error; } finally { await unlink(temporary).catch(() => {}); }
  return output;
}
