# Archived: Render deployment plan

> This is historical documentation and is not the supported deployment path. TerraMatch's required hosting architecture is Vercel Functions and Workflows with Neon and private Vercel Blob. The former root `render.yaml` Blueprint has been removed so it cannot be mistaken for an active deployment target. Do not follow the deployment steps below.

The React/Vite frontend remains on Vercel at `https://terramatch-blue.vercel.app`. This Render service runs only the existing Node API and its discovery/comparison child scripts.

## Render service configuration

The repository root `render.yaml` defines the service. Create a new Render Blueprint from the existing `ahmed-hossaam/TerraMatch` repository and review the plan and disk before applying it.

- Runtime: Node.js web service
- Root directory: repository root
- Compute plan: `1c-2g` (1 CPU, 2 GB RAM; the comparison runner parses large daily climate histories)
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health`
- Port: use Render's injected `PORT`
- Host: `0.0.0.0`
- Persistent disk: 2 GB at `/var/data/terramatch`
- Instances: one; the API's current job lock and JSON storage are single-instance

Render's service filesystem is ephemeral by default. Its persistent disk retains only files written beneath the mount path and requires a paid web service. The API startup initializer seeds the mutable data folders from the checked-in deployment files when the disk folders are empty, then links those established paths to the disk. Curated references, mission profiles, study-area configuration, and baseline evidence remain in the deployed repository tree. The full `data/` tree is not copied to the disk.

## JSON and artifact inventory

The API and the child scripts it launches use these JSON files and path patterns:

| Paths | Use | Persistence |
| --- | --- | --- |
| `data/processed/reference-sites.json`, `data/processed/candidate-points.json` | Authoritative known references and separate candidate test fixtures | Checked-in inputs; not redirected to the disk |
| `data/mission-profiles/mars-surface-v1.json`, `data/discovery/study-areas/*.json` | Mission profile and allowlisted study configurations | Checked-in inputs; not redirected to the disk |
| `data/processed/climate/known-sites-daily.json`, `data/processed/supplementary-evidence/{DALL,DAL,AHS-GH}-{climate,terrain,geology}.json`, `data/processed/terrain/elevation-samples.json`, `data/processed/geology/known-sites-glim.json` | Baseline evidence read by comparison generation | Checked-in inputs; not redirected to the disk |
| `data/processed/mission-profiles/validation-report.json` | Mission-profile status read by the summary API | Checked-in report; not rewritten during API jobs |
| `data/processed/discovery-runs/{runId}.json`, `latest.json`, `validation-report.json`, `validation-reports/{runId}.json` | Discovery archives, current run, and validation reports; read by API, discovery validator, and comparison runner | Persistent disk overlay |
| `data/processed/comparison-runs/{runId}.json`, `latest.json`, `validation-report.json` | Comparison archives, current output, and validation report | Persistent disk overlay |
| `data/app-runtime/jobs/{jobId}.json`, `data/app-runtime/discovery-runs/{jobId}.json`, `data/app-runtime/discovery-validation/{runId}.json` | Job lifecycle, per-job discovery output, and validation input | Persistent disk overlay |
| `data/processed/climate/candidates/{candidateId}-daily.json` | Normalized daily climate histories produced for candidates and read by comparison and candidate detail routes | Persistent disk overlay |
| `data/cache/nasa-power/{cacheKey}.json` | Reusable NASA POWER responses | Persistent disk overlay |
| `data/raw/nasa-power/{siteId}_{period}_{key}.json` and matching `.meta.json` | Preserved NASA POWER responses and request provenance | Persistent disk overlay |
| `data/raw/copernicus-dem/{candidateId}_GLO-30.json`, `data/raw/glim/{candidateId}_GLiM.json` | Reusable raw Copernicus and GLiM responses | Persistent disk overlay |

The checked-in raw provider responses and cache files in those three directories are copied to the disk without overwriting files already on it. The API also reads discovery/comparison run archives and specific candidate evidence JSON files through those same persistent paths. Non-JSON application assets under `web-dist/` are unrelated to the Render API and are not built or served by this service.

## Environment variables

`render.yaml` defines these non-secret values:

| Variable | Value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Select production startup behavior |
| `HOST` | `0.0.0.0` | Expose the HTTP listener to Render's proxy |
| `CORS_ALLOWED_ORIGINS` | `https://terramatch-blue.vercel.app` | Allow browser requests from the deployed frontend; comma-separate additional exact origins |
| `TERRAMATCH_PERSISTENT_DATA_DIR` | `/var/data/terramatch` | Location of the Render persistent disk |
| `PORT` | Render-managed | HTTP port supplied by Render; do not hardcode it |

For a Vercel preview domain, add its exact HTTPS origin to `CORS_ALLOWED_ORIGINS` in the Render dashboard. CORS is not authentication: the current API has no user authentication, and its bounded discovery-job route is publicly callable. Review access controls and abuse limits before promoting this API for unrestricted public use.

## Connect the existing Vercel frontend

After the Render service is deployed and its `/api/health` endpoint returns `200`, open the existing Vercel project's **Settings → Environment Variables** and set:

```text
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

Set it for Production (and Preview if needed), without a trailing slash, then redeploy the existing Vercel project. Vite embeds this variable at build time; the frontend's public Vercel domain does not change. Locally, leave it unset to retain the `/api` path and the Vite development proxy to `127.0.0.1:8787`.

## Local checks

Run these from the repository root in PowerShell:

```powershell
npm ci
npm run build
npm run check:web
npm test
$env:PORT = '8787'
$env:HOST = '127.0.0.1'
npm start
```

In a second terminal, verify the local API:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-RestMethod http://127.0.0.1:8787/api/summary
Invoke-RestMethod http://127.0.0.1:8787/api/references
Invoke-RestMethod http://127.0.0.1:8787/api/profile
Invoke-RestMethod http://127.0.0.1:8787/api/study-areas
```

Do not set `TERRAMATCH_PERSISTENT_DATA_DIR` for ordinary local development. Render's startup overlay is enabled only when that variable is present.
