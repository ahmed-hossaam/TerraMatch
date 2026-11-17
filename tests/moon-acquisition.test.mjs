import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { acquireBoundedFile, writeAcquisitionManifest } from "../scripts/moon/bounded-acquisition.mjs";
import { verifyAcquiredProduct } from "../scripts/moon/verify-acquired-product.mjs";

const bytes = Buffer.from("small deterministic PDS fixture\n");
const digest = createHash("sha256").update(bytes).digest("hex");
const response = (status = 200, body = bytes, contentType = "application/octet-stream") => new Response(body, { status, headers: { "content-type": contentType, ...(status === 200 ? { "content-length": String(Buffer.byteLength(body)) } : {}) } });

test("bounded acquisition writes an immutable file and checksum manifest once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "terramatch-moon-acquire-"));
  try {
    const output = join(dir, "fixture.img");
    const result = await acquireBoundedFile({ url: "https://example.test/data/fixture.img", destination: output, maxBytes: 1000, expectedSha256: digest, repositoryRoot: resolve("."), fetchImpl: async () => response() });
    assert.equal(result.sha256, digest);
    assert.equal(result.byteSize, bytes.length);
    assert.equal(result.reused, false);
    assert.equal(await readFile(output, "utf8"), bytes.toString("utf8"));
    assert.equal(await acquireBoundedFile({ url: "https://example.test/data/fixture.img", destination: output, maxBytes: 1000, expectedSha256: digest, repositoryRoot: resolve("."), fetchImpl: async () => { throw new Error("must not refetch"); } }).then((value) => value.reused), true);
    const manifestPath = join(dir, "fixture.img.manifest.json");
    await writeAcquisitionManifest(manifestPath, result);
    await writeAcquisitionManifest(manifestPath, result);
    assert.equal(JSON.parse(await readFile(manifestPath, "utf8")).sha256, digest);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("acquisition enforces HTTPS, external output, explicit size bounds, and immutable no-overwrite", async () => {
  const dir = await mkdtemp(join(tmpdir(), "terramatch-moon-acquire-"));
  try {
    const output = join(dir, "too-large.img");
    await assert.rejects(acquireBoundedFile({ url: "http://example.test/file", destination: output, maxBytes: 10, repositoryRoot: resolve(".") }), /HTTPS/);
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/file", destination: resolve("data/raw/moon/not-allowed.img"), maxBytes: 10, repositoryRoot: resolve(".") }), /outside the Git repository/);
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/file", destination: output, maxBytes: 4, repositoryRoot: resolve("."), fetchImpl: async () => response() }), /exceeds/);
    assert.equal(await stat(output).then(() => true, () => false), false);
    const existing = join(dir, "existing.img");
    await (await import("node:fs/promises")).writeFile(existing, bytes);
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/file", destination: existing, maxBytes: 1000, repositoryRoot: resolve(".") }), /already exists/);
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/file", destination: existing, maxBytes: 1000, expectedSha256: "0".repeat(64), repositoryRoot: resolve(".") }), /does not match/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("bounded retry distinguishes retryable server errors from client failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "terramatch-moon-acquire-"));
  try {
    let calls = 0;
    const result = await acquireBoundedFile({ url: "https://example.test/file", destination: join(dir, "retry.img"), maxBytes: 1000, expectedSha256: digest, retries: 1, repositoryRoot: resolve("."), fetchImpl: async () => (++calls === 1 ? response(503, "") : response()) });
    assert.equal(calls, 2);
    assert.equal(result.sha256, digest);
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/missing", destination: join(dir, "missing.img"), maxBytes: 1000, retries: 3, repositoryRoot: resolve("."), fetchImpl: async () => { calls++; return response(404, ""); } }), /HTTP 404/);
    assert.equal(calls, 3, "404 must not be retried after the prior two requests");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("checksum mismatch never finalizes an output file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "terramatch-moon-acquire-"));
  try {
    const output = join(dir, "bad.img");
    await assert.rejects(acquireBoundedFile({ url: "https://example.test/file", destination: output, maxBytes: 1000, expectedSha256: "0".repeat(64), retries: 0, repositoryRoot: resolve("."), fetchImpl: async () => response() }), /checksum/);
    assert.equal(await stat(output).then(() => true, () => false), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("acquired-file validator checks path, provenance, size, and checksum", async () => {
  const dir = await mkdtemp(join(tmpdir(), "terramatch-moon-acquire-"));
  try {
    const output = join(dir, "verified.img");
    await (await import("node:fs/promises")).writeFile(output, bytes);
    const manifest = { sourceUrl: "https://example.test/verified.img", byteSize: bytes.length, sha256: digest };
    assert.deepEqual(await verifyAcquiredProduct({ manifest, filePath: output, repositoryRoot: resolve(".") }), []);
    assert.ok((await verifyAcquiredProduct({ manifest: { ...manifest, byteSize: 1 }, filePath: output, repositoryRoot: resolve(".") })).some((error) => error.includes("byte size")));
    assert.ok((await verifyAcquiredProduct({ manifest: { ...manifest, sha256: "0".repeat(64) }, filePath: output, repositoryRoot: resolve(".") })).some((error) => error.includes("checksum")));
    assert.ok((await verifyAcquiredProduct({ manifest, filePath: resolve("data/raw/moon/source.img"), repositoryRoot: resolve(".") })).some((error) => error.includes("outside the repository")));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
