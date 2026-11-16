import assert from "node:assert/strict";
import { test } from "node:test";
import { runPreviewMigrationGate } from "../scripts/migrate-preview-on-vercel-build.mjs";

const verified = {
  statusCode: 200,
  body: { expectedPreviewBranch: true, neonBranchId: "br-wild-sky-bbtfs0t0" },
};

test("Preview migration gate does not run outside Preview or without explicit approval", async () => {
  let migrations = 0;
  const migrate = () => { migrations += 1; };
  const log = () => {};
  assert.equal(await runPreviewMigrationGate({ environment: "production", gitBranch: "main", isolationFlag: "true", migrate, log }), "skipped_environment");
  assert.equal(await runPreviewMigrationGate({ environment: "preview", gitBranch: "backend-preview-integration", isolationFlag: "false", migrate, log }), "skipped_flag");
  assert.equal(await runPreviewMigrationGate({ environment: "preview", gitBranch: "other-branch", isolationFlag: "false", migrate, log }), "skipped_branch");
  assert.equal(migrations, 0);
});

test("Preview migration gate executes only after matching live Preview identity verification", async () => {
  let migrations = 0;
  let verifications = 0;
  const result = await runPreviewMigrationGate({
    environment: "preview",
    gitBranch: "backend-preview-integration",
    isolationFlag: "true",
    verify: async () => { verifications += 1; return verified; },
    migrate: () => { migrations += 1; },
    log: () => {},
  });
  assert.equal(result, "migrated");
  assert.equal(verifications, 1);
  assert.equal(migrations, 1);
});

test("Preview migration gate fails closed on Production or unknown Neon timeline identity", async () => {
  for (const body of [
    { expectedPreviewBranch: false, neonBranchId: "br-plain-lab-bbjrol4l" },
    { expectedPreviewBranch: false, neonBranchId: null },
    { expectedPreviewBranch: true, neonBranchId: "unexpected-branch" },
  ]) {
    let migrations = 0;
    await assert.rejects(runPreviewMigrationGate({
      environment: "preview",
      gitBranch: "backend-preview-integration",
      isolationFlag: "true",
      verify: async () => ({ statusCode: body.expectedPreviewBranch ? 200 : 503, body }),
      migrate: () => { migrations += 1; },
      log: () => {},
    }), /live database identity did not verify/);
    assert.equal(migrations, 0);
  }
});

test("an isolation flag on a different Preview Git branch is rejected", async () => {
  await assert.rejects(runPreviewMigrationGate({
    environment: "preview",
    gitBranch: "unexpected-branch",
    isolationFlag: "true",
    verify: async () => verified,
    migrate: () => assert.fail("Migration must not run for a different Git branch."),
    log: () => {},
  }), /scoped to a different Git branch/);
});
