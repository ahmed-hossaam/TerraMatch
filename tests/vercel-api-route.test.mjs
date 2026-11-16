import assert from "node:assert/strict";
import { test } from "node:test";

const previousVercel = process.env.VERCEL;
const previousCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;
const previousDataDir = process.env.TERRAMATCH_DATA_DIR;
const previousPersistentDataDir = process.env.TERRAMATCH_PERSISTENT_DATA_DIR;
// Exercise the Vercel request adapter against the checked-in local artifact
// store. Preview-only database identity behavior remains separately testable
// through VERCEL_ENV without requiring database credentials in this test.
delete process.env.VERCEL;
process.env.TERRAMATCH_DATA_DIR = process.cwd();
delete process.env.TERRAMATCH_PERSISTENT_DATA_DIR;
process.env.CORS_ALLOWED_ORIGINS = "https://terramatch-blue.vercel.app";
const { default: apiHandler } = await import("../server/routes/api/[...].mjs");
if (previousVercel === undefined) delete process.env.VERCEL;
else process.env.VERCEL = previousVercel;
if (previousDataDir === undefined) delete process.env.TERRAMATCH_DATA_DIR;
else process.env.TERRAMATCH_DATA_DIR = previousDataDir;
if (previousPersistentDataDir === undefined) delete process.env.TERRAMATCH_PERSISTENT_DATA_DIR;
else process.env.TERRAMATCH_PERSISTENT_DATA_DIR = previousPersistentDataDir;
if (previousCorsOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
else process.env.CORS_ALLOWED_ORIGINS = previousCorsOrigins;

test("Vercel API route adapts a web request and returns the existing health contract", async () => {
  const req = new Request("https://terramatch-preview.example/api/health");
  const response = await apiHandler({ req, url: new URL(req.url) });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), {
    status: "ok",
    app: "TerraMatch",
    planetaryScope: "Mars",
    apiVersion: "1.0.0",
  });
});

test("Vercel API route serves the exact summary request used by the frontend", async () => {
  const req = new Request("https://terramatch-preview.example/api/summary");
  const response = await apiHandler({ req, url: new URL(req.url) });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  const summary = await response.json();
  assert.equal(summary.referenceCount, 31);
  assert.equal(summary.fixtureCount, 3);
  assert.ok(summary.latestDiscoveryRunId);
});

test("Vercel API route retrieves an existing comparison artifact and safely rejects missing or invalid IDs", async () => {
  const latestRequest = new Request("https://terramatch-preview.example/api/comparison-runs/latest?offset=0&limit=1");
  const latestResponse = await apiHandler({ req: latestRequest, url: new URL(latestRequest.url) });
  assert.equal(latestResponse.status, 200);
  const latest = await latestResponse.json();
  assert.ok(latest.runId);
  assert.equal(latest.comparisons.length, 1);
  assert.ok(latest.pagination.totalRecords > 0);
  assert.doesNotMatch(JSON.stringify(latest), /blob_path|storeId|BLOB_READ_WRITE_TOKEN|postgres(?:ql)?:\/\//i);

  const missingRequest = new Request("https://terramatch-preview.example/api/comparison-runs/00000000-0000-0000-0000-000000000000");
  const missingResponse = await apiHandler({ req: missingRequest, url: new URL(missingRequest.url) });
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: "Run not found." });

  const invalidRequest = new Request("https://terramatch-preview.example/api/comparison-runs/not-valid!");
  const invalidResponse = await apiHandler({ req: invalidRequest, url: new URL(invalidRequest.url) });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { error: "Invalid run ID." });

  const blockedRequest = new Request("https://terramatch-preview.example/api/summary", {
    method: "OPTIONS",
    headers: { origin: "https://untrusted.example" },
  });
  const blockedResponse = await apiHandler({ req: blockedRequest, url: new URL(blockedRequest.url) });
  assert.equal(blockedResponse.status, 403);
  assert.deepEqual(await blockedResponse.json(), { error: "Origin is not allowed." });
});

test("Vercel API route handles browser CORS preflight through the web adapter", async () => {
  const req = new Request("https://terramatch-preview.example/api/health", {
    method: "OPTIONS",
    headers: { origin: "https://terramatch-blue.vercel.app" },
  });
  const response = await apiHandler({ req, url: new URL(req.url) });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://terramatch-blue.vercel.app");
});

test("database identity diagnostic is hidden in Production", async () => {
  const previousEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const req = new Request("https://terramatch.example/api/diagnostics/database-identity");
    const response = await apiHandler({ req, url: new URL(req.url) });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found." });
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
});

test("Preview identity diagnostic fails closed when its database binding is unavailable", async () => {
  const previousEnvironment = process.env.VERCEL_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.VERCEL_ENV = "preview";
  delete process.env.DATABASE_URL;
  try {
    const req = new Request("https://terramatch.example/api/diagnostics/database-identity");
    const response = await apiHandler({ req, url: new URL(req.url) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: "unavailable",
      deploymentEnvironment: "preview",
      neonProjectId: null,
      neonBranchId: null,
      neonBranchName: null,
      expectedPreviewBranch: false,
    });
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
