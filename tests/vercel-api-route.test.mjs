import assert from "node:assert/strict";
import { test } from "node:test";

const previousVercel = process.env.VERCEL;
const previousCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;
process.env.VERCEL = "1";
process.env.CORS_ALLOWED_ORIGINS = "https://terramatch-blue.vercel.app";
const { default: apiHandler } = await import("../server/routes/api/[...].mjs");
if (previousVercel === undefined) delete process.env.VERCEL;
else process.env.VERCEL = previousVercel;
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
