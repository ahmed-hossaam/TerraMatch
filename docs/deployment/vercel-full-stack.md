# Vercel full-stack deployment

TerraMatch's supported hosting target is the existing Vercel project `terramatch`:

- Vite frontend and SPA routes.
- Node.js API function and durable Vercel Workflow execution.
- Neon PostgreSQL for durable job and artifact metadata.
- Private Vercel Blob for immutable and mutable artifact content.

Local development continues to use the local JSON artifact store and the existing API server. Vercel production never treats function-local files as durable storage. The retired Render Blueprint was removed; [`render-backend.md`](render-backend.md) is retained as historical documentation only.

## Build and environment

Vercel's root `vercel.json` runs `scripts/verify-vercel-build-env.mjs` followed by `npm run build:vercel`. The guard requires `VERCEL_DEPLOYMENT_ID`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_STORE_ID`, and either `VERCEL_OIDC_TOKEN` or `BLOB_READ_WRITE_TOKEN`. It logs names/status only, never values. Workflows require the Vercel system deployment identity at build and runtime.

The integration configuration should supply the connection and storage variables to both Preview and Production. The variable names alone do not prove Preview database isolation; inspect the Neon endpoint/branch assignment for each environment before running any migration, discovery job, comparison job, or other database write. Preview builds and storage access fail closed until `TERRAMATCH_PREVIEW_DB_ISOLATED=true` is set after this check.

## Data migration and safety

`npm run migrate:vercel-data` is deliberately not part of the Vercel build command. It seeds the checked-in data manifest idempotently, refuses to proceed when tracked scientific data is modified, preserves historical immutable artifact content, verifies database metadata checksums, and reads selected artifacts back through private Blob. The script requires an explicitly selected Vercel environment; Preview additionally requires `TERRAMATCH_PREVIEW_DB_ISOLATED=true` after the Neon endpoint has been verified as a separate branch, while Production additionally requires `TERRAMATCH_PRODUCTION_MIGRATION_APPROVED=true` after Preview passes. Do not run a Preview migration if Preview resolves to the Production branch.

Preview and Production currently share the connected private Blob store. Artifact content uses immutable content-addressed paths; the test artifact used for Blob verification must have a unique test prefix and be removed by exact key after verification. Never make the store public.

## Release sequence

1. Build and push a dedicated Preview branch.
2. Confirm the Vercel build reports deployment identity availability.
3. Confirm the Preview Neon endpoint is an isolated non-production branch before running `npm run migrate:vercel-data` or submitting a job.
4. Verify migration counts/checksums and a private Blob readback.
5. Verify real bounded Discovery and Comparison Workflows, job polling, retry and artifact persistence in Preview.
6. Only after all Preview checks pass, merge the verified commit to `main` and release Production.

Do not claim Neon persistence, Blob durability, or Workflow execution is verified based only on a local build. Record the actual Vercel deployment and database branch used for each environment.
