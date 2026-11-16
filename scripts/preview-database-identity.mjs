// These opaque IDs are public Neon control-plane identifiers, not credentials.
// The expected timeline values were read from each branch with a read-only SQL
// query through the authorized Neon connection. Comparing the live server's
// GUCs to them verifies the database actually reached by DATABASE_URL.
const expected = {
  projectId: "wispy-bar-86157767",
  tenantId: "d8d261fb7aa9fda78a0e627681fd9ca9",
  preview: {
    branchId: "br-wild-sky-bbtfs0t0",
    branchName: "preview/backend-preview-integration",
    timelineId: "70db87442bf585ffa5c6535f5dd30f6e",
  },
  production: {
    branchId: "br-plain-lab-bbjrol4l",
    branchName: "main",
    timelineId: "5a5268c5293f13069027e6b7fb916fcf",
  },
};

function emptyIdentity(deploymentEnvironment) {
  return {
    deploymentEnvironment,
    neonProjectId: null,
    neonBranchId: null,
    neonBranchName: null,
    expectedPreviewBranch: false,
  };
}

/**
 * Verify the live connection using a read-only transaction. Never returns or
 * logs connection details. clientFactory is injectable for deterministic tests.
 */
export async function verifyPreviewDatabaseIdentity({
  deploymentEnvironment = process.env.VERCEL_ENV,
  databaseUrl = process.env.DATABASE_URL,
  clientFactory,
} = {}) {
  if (deploymentEnvironment !== "preview") return { statusCode: 404, body: { error: "Not found." } };
  if (!databaseUrl) return { statusCode: 503, body: { status: "unavailable", ...emptyIdentity("preview") } };

  let client;
  let transactionOpen = false;
  try {
    const factory = clientFactory ?? (async (config) => {
      const { Client } = await import("pg");
      return new Client(config);
    });
    client = await factory({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
      // Enforce read-only behavior at the PostgreSQL session as well as in SQL.
      options: "-c default_transaction_read_only=on",
    });
    await client.connect();
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;
    const result = await client.query(`
      SELECT current_setting('neon.tenant_id', true) AS tenant_id,
             current_setting('neon.timeline_id', true) AS timeline_id
    `);
    await client.query("COMMIT");
    transactionOpen = false;

    const row = result?.rows?.[0];
    if (!row?.tenant_id || !row?.timeline_id) {
      return { statusCode: 503, body: { status: "unavailable", ...emptyIdentity("preview") } };
    }

    const projectMatches = row.tenant_id === expected.tenantId;
    const previewMatches = projectMatches && row.timeline_id === expected.preview.timelineId;
    const productionMatches = projectMatches && row.timeline_id === expected.production.timelineId;
    const matchedBranch = previewMatches ? expected.preview : productionMatches ? expected.production : null;
    const body = {
      status: previewMatches ? "verified" : "mismatch",
      deploymentEnvironment: "preview",
      neonProjectId: projectMatches ? expected.projectId : null,
      neonBranchId: matchedBranch?.branchId ?? null,
      neonBranchName: matchedBranch?.branchName ?? null,
      expectedPreviewBranch: previewMatches,
    };
    return { statusCode: previewMatches ? 200 : 503, body };
  } catch {
    // Deliberately omit provider error text: driver errors can contain hosts or
    // other connection details. An unverifiable target fails closed.
    return { statusCode: 503, body: { status: "unavailable", ...emptyIdentity("preview") } };
  } finally {
    if (transactionOpen) await client?.query("ROLLBACK").catch(() => {});
    await client?.end?.().catch(() => {});
  }
}
