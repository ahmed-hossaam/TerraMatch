import process from "node:process";

const required = ["VERCEL_DEPLOYMENT_ID", "DATABASE_URL", "DATABASE_URL_UNPOOLED", "BLOB_STORE_ID"];
const missing = required.filter((name) => !process.env[name]);
if (!process.env.VERCEL_OIDC_TOKEN && !process.env.BLOB_READ_WRITE_TOKEN) missing.push("VERCEL_OIDC_TOKEN or BLOB_READ_WRITE_TOKEN");
if (process.env.VERCEL_ENV === "preview" && process.env.TERRAMATCH_PREVIEW_DB_ISOLATED !== "true") {
  console.warn("Preview build is allowed before database isolation is attested; durable API storage remains fail-closed until TERRAMATCH_PREVIEW_DB_ISOLATED=true is set after branch verification.");
}
if (missing.length) {
  console.error(`Full-stack Vercel build cannot proceed; required environment names are missing: ${missing.join(", ")}.`);
  process.exitCode = 1;
} else {
  console.log("Vercel deployment identity and durable storage integrations are available.");
}
