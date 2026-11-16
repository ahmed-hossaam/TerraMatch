import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPreviewDatabaseIdentity } from "../scripts/preview-database-identity.mjs";

const previewRow = {
  tenant_id: "d8d261fb7aa9fda78a0e627681fd9ca9",
  timeline_id: "70db87442bf585ffa5c6535f5dd30f6e",
};

function clientFor(row, calls, failure = null) {
  return async (config) => {
    calls.config = config;
    return {
      async connect() { calls.connected = true; },
      async query(sql) {
        calls.queries.push(sql.trim());
        if (failure) throw failure;
        return sql.includes("current_setting") ? { rows: [row] } : { rows: [] };
      },
      async end() { calls.ended = true; },
    };
  };
}

test("database identity diagnostic is hidden outside Preview without connecting", async () => {
  let called = false;
  const result = await verifyPreviewDatabaseIdentity({
    deploymentEnvironment: "production",
    databaseUrl: "unused",
    clientFactory: async () => { called = true; },
  });
  assert.equal(result.statusCode, 404);
  assert.equal(called, false);
});

test("diagnostic proves the actual Preview database with a read-only Neon identity query", async () => {
  const calls = { queries: [] };
  const result = await verifyPreviewDatabaseIdentity({
    deploymentEnvironment: "preview",
    databaseUrl: "postgres://test-only.invalid/db",
    clientFactory: clientFor(previewRow, calls),
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    status: "verified",
    deploymentEnvironment: "preview",
    neonProjectId: "wispy-bar-86157767",
    neonBranchId: "br-wild-sky-bbtfs0t0",
    neonBranchName: "preview/backend-preview-integration",
    expectedPreviewBranch: true,
  });
  assert.match(calls.queries[0], /^BEGIN READ ONLY$/);
  assert.match(calls.queries[1], /current_setting\('neon\.tenant_id', true\)/);
  assert.match(calls.queries[1], /current_setting\('neon\.timeline_id', true\)/);
  assert.match(calls.queries[2], /^COMMIT$/);
  assert.match(calls.config.options, /default_transaction_read_only=on/);
  assert.equal(calls.ended, true);
  assert.doesNotMatch(JSON.stringify(result.body), /host|password|connection|string|timeline/i);
});

test("Production branch is identified but cannot satisfy the Preview isolation gate", async () => {
  const calls = { queries: [] };
  const result = await verifyPreviewDatabaseIdentity({
    deploymentEnvironment: "preview",
    databaseUrl: "postgres://test-only.invalid/db",
    clientFactory: clientFor({ ...previewRow, timeline_id: "5a5268c5293f13069027e6b7fb916fcf" }, calls),
  });
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.neonProjectId, "wispy-bar-86157767");
  assert.equal(result.body.neonBranchId, "br-plain-lab-bbjrol4l");
  assert.equal(result.body.expectedPreviewBranch, false);
});

test("unknown database and connection failures fail closed without leaking provider details", async () => {
  const calls = { queries: [] };
  const unknown = await verifyPreviewDatabaseIdentity({
    deploymentEnvironment: "preview",
    databaseUrl: "postgres://test-only.invalid/db",
    clientFactory: clientFor({ tenant_id: "other", timeline_id: "other" }, calls),
  });
  assert.equal(unknown.statusCode, 503);
  assert.equal(unknown.body.neonProjectId, null);
  assert.equal(unknown.body.neonBranchId, null);
  assert.equal(unknown.body.expectedPreviewBranch, false);

  const failed = await verifyPreviewDatabaseIdentity({
    deploymentEnvironment: "preview",
    databaseUrl: "postgres://test-only.invalid/db",
    clientFactory: clientFor(null, { queries: [] }, new Error("secret-host password connection URI")),
  });
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(failed.body, {
    status: "unavailable",
    deploymentEnvironment: "preview",
    neonProjectId: null,
    neonBranchId: null,
    neonBranchName: null,
    expectedPreviewBranch: false,
  });
  assert.doesNotMatch(JSON.stringify(failed.body), /secret-host|password|URI/i);
});
