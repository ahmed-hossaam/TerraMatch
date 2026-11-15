# TerraMatch application layer

The application is a thin presentation and orchestration layer over the M01–M08 scientific artifacts. The React code does not run scientific calculations. A small Node.js HTTP service exposes allowlisted JSON DTOs and starts the existing discovery and comparison scripts for an allowed study area and mission.

## Start locally

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:5173/`. The development command compiles the scientific TypeScript, type-checks the web code, starts the API at `127.0.0.1:8787`, and starts Vite. Stop both processes with Ctrl+C.

For a production-style local build and one-port server:

```powershell
npm.cmd run build:app
npm.cmd start
```

The API serves the generated SPA from `web-dist` at `http://127.0.0.1:8787/`. `PORT` can change the API port. `APP_JOB_TIMEOUT_MS` sets the child-process deadline (default 180,000 ms). No API keys or account credentials are required. The API binds to loopback by default; putting this unauthenticated prototype on a public interface requires a separately reviewed deployment configuration and execution limits.

## Browser verification

This checkout has no automated browser E2E harness and no E2E test command. A manual browser smoke check confirmed the landing page; Explore rendering with known-reference markers and four configured candidate cells; mission profile, evidence readiness, and bounded study-area controls; the comparison matrix and geological-process missing-evidence explanation; the report filtered to one candidate/reference pair; region-level reference filtering; and switching between dark and light themes. The smoke check did not start discovery because that action makes live provider requests, and it did not test map panning/zoom. These checks are not an automated E2E pass. Re-run deterministic automated checks with `npm.cmd test`, `npm.cmd run check:web`, and `npm.cmd run build:app`.

## Pages

- `/` — cinematic mission landing page with a persisted theme switch, lazy-loaded Earth–Mars scene, pointer parallax, editorial About section, five-stage M01–M08 workflow, source limitations, and live artifact counts. Static CSS planets remain visible on small screens, constrained devices, reduced-motion preferences, or WebGL fallback.
- `/explore` — MapLibre map, reference pins, candidate sampling centers and configured grid-cell polygons, provider states, the latest M07/M08 artifact summary, and a pointer-safe ambient backdrop behind workspace content. Region-only references remain unpinned.
- `/references` and `/references/:id` — searchable, filterable, sortable, paginated reference inventory and source details. Region-only records do not receive map pins.
- `/discover` — mission selection, factor-by-factor evidence readiness from the versioned profile, bounded area selection, then a real queued/running/completed/failed API job. Unsupported factors and retrieval limitations are shown before execution.
- `/runs` and `/runs/discovery/:runId` — persisted discovery and comparison archive listings and individual discovery outputs.
- `/candidate/:id` — stored NASA POWER daily history, source summary, GLiM output, DEM state, provenance, and limitations.
- `/comparison?run=:runId` — selectable candidate/reference factor matrix with state/factor/reference filters, expandable evidence details, and pagination.
- `/methodology` — M01–M08 explanation, profile requirements, source descriptions, and scientific limits.
- `/report/:runId` — print-optimized report populated from a real comparison artifact. **Print / Save as PDF** opens the browser print dialog; select “Save as PDF.” This is browser PDF export, not server-side PDF generation.

The default area is `atacama-climate-transect-v2`: a 0.4° × 0.4° area on a 0.2° grid (four configured cells), with a 75 km point-reference mask and a 12-call ceiling (four cells × three configured providers). It is explicitly a workflow demonstration; the original one-cell v1 config remains intact. Its rationale and limitations are returned through `/api/study-areas`. Coordinate-free references remain unmasked. The API accepts only a mission ID in the existing profile and an area ID from the repository's configured study-area folder. It does not accept file paths, arbitrary commands, arbitrary provider URLs, or unbounded grids. At most one app discovery job runs at a time. The job validates its exact discovery output before publishing that run as latest, then runs and validates the paired comparison. Validation failures are distinct from provider failures and mark the job failed at the corresponding stage; no percentages are invented. Jobs are stored beneath ignored `data/app-runtime/` JSON files. The direct default CLI discovery follows the same validate-before-publish lifecycle.

## API

The browser can read only named DTO endpoints; it never constructs filesystem paths.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | App/API status and Mars scope |
| GET | `/api/summary` | Compact latest run and inventory counts |
| GET | `/api/references` | Known-site inventory only |
| GET | `/api/references/:id` | One known reference |
| GET | `/api/profile` | Validated Mars mission-profile artifact |
| GET | `/api/study-areas` | Configured allowlisted search areas |
| GET | `/api/discovery-runs` | Archived M07 run index |
| GET | `/api/discovery-runs/latest` or `/api/discovery-runs/:runId` | Latest or archived M07 run |
| GET | `/api/comparison-runs` | Archived M08 run index |
| GET | `/api/comparison-runs/latest` or `/api/comparison-runs/:runId` | Latest or archived M08 matrix |
| GET | `/api/candidates/:id/evidence?run=:runId` | Candidate evidence from a stored run |
| POST | `/api/jobs` | Start one bounded job: `{ "missionId": "…", "studyAreaId": "…" }` |
| GET | `/api/jobs` and `/api/jobs/:jobId` | App-local job index and actual status/logs |

Requests are capped at 8 KB; IDs are validated, run/config IDs are allowlisted, requests time out, and only one discovery job may run concurrently. Error responses do not expose local stack traces. The API binds to `127.0.0.1` by default.

## Maps and licensing

MapLibre GL JS and the Explore/Comparison workspaces are lazy-loaded when their routes open. The map defaults to Esri World Imagery for geographic context, with bundled Natural Earth land outlines and points retained if imagery cannot load; the imagery can be switched off. Remote basemap tiles are visual context only and are never evidence. The visible map attribution identifies Esri imagery and Natural Earth outlines. MapLibre documents the Vite worker URL setup in its [installation guide](https://maplibre.org/maplibre-gl-js/docs/).

## Data boundaries and limitations

- The 31 records returned by the reference API are all `known_analog`. Three fixtures remain separate and are counted separately; they are not map pins or discovery results.
- Map pins exist only for records with valid coordinates. Region-level Semail and Dasht-e Lut remain visible in lists and comparisons without invented point locations.
- The latest discovery artifact is a bounded Atacama demonstration grid, not a global discovery result. Candidate polygons are computed from the actual run's study-area bounds, cell spacing, row, and column; the center pin is a sampling coordinate, not a precise field site. Status color reflects the recorded screening state. Starting a job executes the existing M07 and M08 programs; it does not simulate progress.
- NASA POWER is gridded climate data, not field observations. The displayed T2M chart is drawn from the candidate's stored daily history; valid/missing counts and period are shown. Radiation is not UV.
- A Copernicus GLO-30 value is one DSM elevation pixel, not terrain characterization. Failed elevation remains failed.
- GLiM provides generalized mapped lithology, not mineral detection or site-level ground truth.
- M08 comparisons are descriptive factor records. Compatible daily climate comparisons include calendar-season and year-stratified means, valid and missing counts, and coverage; hemisphere labels are retained and the quarterly seasons are not mission-specific climate seasons. No score, ranking, confidence percentage, or suitability conclusion is shown.
- Local JSON archive persistence is not guaranteed across hosting deployments. There is no database or authentication layer.

## UI technology

React 19, TypeScript, Vite, React Router, MapLibre GL JS, Three.js, React Three Fiber, and Drei are used. The app uses a small custom CSS token/component layer; the landing route and workspace routes are code-split. The climate line chart and print report use native SVG/HTML/CSS. The landing scene builds Earth, cloud, and Mars textures locally from bundled world-atlas data and deterministic surface texture; it makes no image requests. Earth and Mars retain their existing meshes, with continuous rotation, a shallow elliptical Mars orbit, camera parallax, sparse stars, low-density dust points, one infrequent shooting star, and an orbital particle; the canvas is lazy-mounted only near the hero and omitted for reduced-motion, small-screen, and constrained devices. Workspace background orbs and stars are a separate fixed CSS layer behind the shell, with pointer events disabled and distinct dark/light treatments. Dark mode is the default; theme preference is stored in local storage and shared across routes. Native smooth scrolling preserves anchor and keyboard behavior; reveal motion and route transitions respect `prefers-reduced-motion`.

Reference records retain original source fields. The bounded reference API provides curated English country labels and recursively omits Arabic-only text from its display DTOs; those fields become null in the app response while source atlas and normalized research artifacts remain unchanged.
