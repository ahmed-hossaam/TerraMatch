# Phase 9 — Real Lunar Map Integration

## Outcome

**Real-data integration is blocked by unavailable product bytes. TerraMatch still has only the neutral lunar coordinate prototype; it does not yet have a data-backed lunar map.** This phase did not fabricate layers or enable products based on registry metadata alone. It adds the explicit inspection gate that was missing from the map-readiness model and exposes that state in the existing API and UI.

## What changed

- Added `inspection` as an additive lifecycle field, separate from source metadata review, product-validation adapter implementation, scientific validation, and map delivery.
- Updated map-layer eligibility: a layer can only render after acquisition, file-level inspection, processing, validation, and delivery preparation are all complete, with a Moon CRS and supported renderer.
- Added distinct API/UI availability states: `not_inspected`, `not_processed`, `not_validated`, and `not_delivery_ready`. Summary responses add the count of inspected products; layer responses include inspection and delivery status. Existing API fields are retained.
- `/moon` readiness strip and layer detail cards show the inspection stage; `/moon/evidence` exposes per-product file inspection independently from metadata and validation adapter status.
- Added regression tests for the ordered readiness gates and the API/UI inspection state.

## Current status of all 13 families

| Dataset family | Product selected | Metadata | Acquired | Inspected | Processed | Product validated | Delivery-ready | Renderable |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| LOLA global topography | Yes | Partial | No | No | No | No | No | No |
| Kaguya LALT topography | Yes | Partial | No | No | No | No | No | No |
| Diviner thermal | Yes | Partial | No | No | No | No | No | No |
| LROC WAC | No | Unknown | No | No | No | No | No | No |
| LROC NAC | No | Partial | No | No | No | No | No | No |
| Chandrayaan-1 M³ | Yes | Partial | No | No | No | No | No | No |
| Clementine UVVIS | No | Unknown | No | No | No | No | No | No |
| LRO illumination | Yes | Partial | No | No | No | No | No | No |
| Permanently shadowed regions | No | Unknown | No | No | No | No | No | No |
| LRO LEND hydrogen | Yes | Partial | No | No | No | No | No | No |
| GRAIL gravity models | Yes | Partial | No | No | No | No | No | No |
| Mini-RF radar | Yes | Partial | No | No | No | No | No | No |
| USGS Unified Geologic Map | Yes | Partial | No | No | No | No | No | No |

Computed registry counts: **13 registered, 9 selected, 10 partial metadata and 3 unknown metadata; 0 acquired, 0 inspected, 0 processed, 0 product-validated, 0 delivery-ready, and 0 renderable.** All 13 validation adapters are implemented; this does not mean any source product was validated. Coverage fractions remain unknown. The registry includes global, near-global, polar, and targeted families; no geographic coverage was recalculated.

## Map and user experience

- Real lunar layers integrated: **0**.
- Current renderer: isolated SVG geographic/equirectangular coordinate prototype, with near/far longitude windows and north/south coordinate windows. The polar windows are not polar projections.
- No Earth basemap, lunar terrain/image/geology, feature names, tile URL, or raster/vector delivery endpoint is introduced.
- Data families remain selectable only as catalog records; unavailable layers remain disabled, with status/reason and source limitations visible.
- API metadata routes remain `/api/moon/summary`, `/api/moon/datasets`, `/api/moon/datasets/:datasetId`, `/api/moon/coverage`, `/api/moon/layers`, and `/api/moon/map-config`. No tile/feature endpoint was added.
- No local file path or artifact URL is exposed.

## Browser QA

Browser verification was **not performed**. The computer-use browser inventory reported “Local browser use is disabled in Work settings.” A local `npm run dev` attempt completed build and web-check steps but could not bind its API server because `127.0.0.1:8787` was already in use. No process was stopped or changed. This is not evidence of a rendered browser pass. Manual follow-up should open `/moon` and `/moon/evidence` at desktop and 390 px mobile widths, exercise the five coordinate-window buttons and expandable source metadata, and inspect the browser console/network panel.

## Verification and regression

- Focused Moon API, map, evidence, architecture tests: **22 passed, 0 failed**.
- Full `npm test`: **141 passed, 0 failed**.
- `npm run check:web`: passed.
- `npm run build:web`: passed with output redirected to a unique external temporary directory to protect the two pre-existing modified `web-dist/assets/maplibre-gl*` files; Vite reported existing large MapLibre/Three chunk-size warnings.
- `npm run build:vercel`: passed; workflow compiler reported 24 steps and generated the Vercel Nitro output. Existing chunk-size and bundler diagnostic warnings remain.
- `npm run moon:registry:validate`, `npm run validate:mars-rems`, `npm run validate:data`, `npm run validate:reference-sites`, `npm run validate:mission-profiles`, `npm run validate:evidence`, `npm run validate:discovery`, and `npm run validate:comparison`: all passed. Validation outputs were directed into `dist/phase789-qa/` where the scripts support overrides; historical reports and runs were not overwritten.
- Mars REMS and Earth reference regression tests passed. No Earth map code, Mars REMS implementation, Earth records/curation, or Earth reference API was changed by these three phases.

## Git and deployment state

- Branch remains `backend-preview-integration`; HEAD remains `46b834d`.
- The original two modified MapLibre files were preserved and not edited by this work. The web build was redirected outside `web-dist`.
- No deployment, migration, production configuration change, commit, or push occurred.

## Blocker and next concrete step

The verified candidate LOLA `LDEM_4` PDS URL was not reachable from the execution environment (`HttpRequestException` on a bounded HEAD request). Without source bytes and checksums, product inspection, processing, artifact validation, and renderer delivery cannot truthfully advance. Once source access is available, acquire `LDEM_4.JP2` and its PDS label/auxiliary metadata into an external cache, inspect format/NoData, then choose and test a decoder and map-delivery format before enabling the layer. The 224 MB USGS package and Diviner archive also require bounded, product-specific acquisition and review before inclusion.
