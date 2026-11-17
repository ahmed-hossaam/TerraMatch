# Phase 5 — Moon API and Frontend

## Objective and Git state

Expose the versioned Moon catalog through the existing API handler and add an API-driven destination page without changing the Mars or Earth contracts.

- Branch: `backend-preview-integration`
- Commit at implementation start: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`
- No branch switch, commit, push, deployment, database operation, migration, or environment change occurred.

## API implementation

Added `src/moon/api.ts`, a pure metadata-only response layer. It validates the current registry before serving results, does not open the artifact store, read local cache paths, acquire products, initialize schema, or access a database. `scripts/app-api.mjs` routes `/api/moon/*` through this handler before general artifact loading, preserving the existing Vercel/Node API architecture.

Endpoints:

- `GET /api/moon/summary` — destination, global catalog scope, registered/selected/acquired/processed/validated/renderable counts, and known readiness gaps.
- `GET /api/moon/datasets?offset=0&limit=13` — paginated list of all registered dataset families.
- `GET /api/moon/datasets/:datasetId` — product metadata, provenance, status, limitations, and corresponding map-layer state.
- `GET /api/moon/coverage` — product scope and explicit unknown coverage fractions; no unsupported percentages.
- `GET /api/moon/layers?offset=0&limit=13` — separates actual renderable layers from registered but unavailable layers.
- `GET /api/moon/map-config` — lunar coordinate metadata and neutral prototype configuration; no fake basemap/tile URL.

Errors use HTTP status plus `code` and `error` fields: invalid query/ID (400), unknown dataset/endpoint (404), unsupported method (405), and invalid registry (503). Collection limits are bounded to 13 entries. No feature endpoint was added because there is no validated lunar feature source.

Current API counts: 13 registered; 9 product selections marked completed; 0 acquired; 0 processed; 0 validated; 0 renderable. Validation adapter implementation is not represented as validation of data products.

## Frontend implementation

- Added `/moon` as a lazy-loaded route, a Moon navigation entry, and a landing-page route link.
- `web/src/MoonPage.tsx` requests summary, datasets, layer states, coverage, and map configuration through the shared `api()` client. It presents readiness counts, the coordinate prototype, coverage classifications, and explicit loading/error/retry states.
- The Moon map receives its coordinate reference and layer catalog from the API. Shared layer eligibility logic now lives in `src/moon/map-layers.ts`, used by both API and UI.
- The active destination label changes to `MOON · GLOBAL PROTOTYPE` on Moon routes. Existing Earth and Mars route definitions remain present.
- Updated the Moon destination map metadata to report the actual geographic prototype projection and its 13 registered dataset IDs.

## Files created or modified in this phase

- Created: `src/moon/api.ts`, `src/moon/map-layers.ts`, `web/src/moon/moon-api.ts`, `web/src/MoonPage.tsx`, `web/src/moon/moon-page.css`.
- Modified: `scripts/app-api.mjs`, `src/destinations/registry.ts`, `web/src/moon/moon-map-adapter.ts`, `web/src/moon/moon-map-layers.ts`, `web/src/moon/MoonMapView.tsx`, `web/src/App.tsx`, `web/src/MissionLanding.tsx`, `tests/app-api.test.mjs`, `tests/moon-map.test.ts`.
- Added tests: `tests/moon-api.test.ts`.

## Verification

- `npm test`: **131 passed, 0 failed**.
- `npm run check:web`: passed.
- API integration test started the existing local API and verified all six endpoints, list pagination, detail and unknown-ID behavior, null coverage values, 13 unavailable layers, zero renderable layers, and lack of path/token fields.
- Existing API regression suite verified `/api/mars-evidence/rems`, `/api/references`, profile, discovery, comparison, and CORS behavior.
- Browser verification: not performed; no browser run was part of this phase.

## Limitations and blockers

The API exposes a static metadata registry only. It does not serve files, map tiles, feature geometries, or downloaded product measurements. Frontend status is API-driven, but the scientific catalog contents originate from the existing checked-in registry. Moon mission profiles are not introduced. The map remains a coordinate prototype and reports no real-data layers.

No deployment or migration occurred.
