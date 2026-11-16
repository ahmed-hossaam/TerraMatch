import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyPreviewDatabaseIdentity } from "./preview-database-identity.mjs";

/** Run the existing additive seed only in this verified Preview Git branch. */
export async function runPreviewMigrationGate({
  environment = process.env.VERCEL_ENV,
  gitBranch = process.env.VERCEL_GIT_COMMIT_REF,
  isolationFlag = process.env.TERRAMATCH_PREVIEW_DB_ISOLATED,
  verify = verifyPreviewDatabaseIdentity,
  migrate = () => execFileSync(process.execPath, ["scripts/migrate-vercel-data.mjs"], { stdio: "inherit" }),
  log = console.log,
} = {}) {
  if (environment !== "preview") {
    log("Preview migration gate skipped outside Preview.");
    return "skipped_environment";
  }
  if (gitBranch !== "backend-preview-integration") {
    if (isolationFlag === "true") throw new Error("Preview migration gate blocked: isolation approval is scoped to a different Git branch.");
    log("Preview migration gate skipped for an unapproved Git branch.");
    return "skipped_branch";
  }
  if (isolationFlag !== "true") {
    log("Preview migration gate skipped because Preview isolation has not been approved.");
    return "skipped_flag";
  }

  const verification = await verify();
  if (verification.statusCode !== 200 || verification.body?.expectedPreviewBranch !== true
      || verification.body?.neonBranchId !== "br-wild-sky-bbtfs0t0") {
    throw new Error("Preview migration gate blocked: the live database identity did not verify as the approved isolated Neon Preview branch.");
  }

  await migrate();
  return "migrated";
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runPreviewMigrationGate();
}
