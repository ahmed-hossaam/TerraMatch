# TerraMatch Moon Finalization — Phases 11–16

## Outcome

**`MOON_RESEARCH_PREVIEW_READY`** — a real LRO LOLA LDEM_4 relative-height display preview is available in the Moon UI and coordinate inspection reads the existing processed array. North and south polar stereographic display derivatives have since been added. These remain unvalidated previews, not registry renderable layers. Independent RDR comparison, a standard geospatial delivery artifact, and fresh browser visual verification remain incomplete.

## Starting state and preservation

- Branch: `backend-preview-integration`.
- HEAD at start: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a` (`46b834d`); no branch changes, commit, push, or deployment occurred.
- The working tree was already dirty, including prior Moon implementation files, report outputs, and the two protected MapLibre bundles. Those unrelated changes were preserved. This work did not write either protected `web-dist/assets/maplibre-gl-BJqcOGhp.js` or `web-dist/assets/maplibre-gl-worker-Dlv-oLtU.js`.
- The existing processed `ldem_4_height_m.npy`, its original JSON sidecar, source-cache files, and Mars/Earth data were not rewritten. No database, Blob, environment, credential, migration, or production operation occurred.

## Phase 11 — Independent LOLA point validation

**Blocked; no independent observations were retrieved.** Phase 10's documented mapping is used for display and cell lookup, not claimed as independent validation. The official sources reviewed in the previous spatial-validation phase include the [PDS Geosciences `dsmap.cat`](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/catalog/dsmap.cat), [LOLA archive SIS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/archsis.htm), [LOLA RDR SIS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/rdrsis.htm), and [ODE LOLA RDR query documentation](https://oderest.rsl.wustl.edu/GDSWeb/GDSLOLARDR.html). The ODE query documentation describes asynchronous point queries whose results are delivered separately. No query was submitted in this phase and no RDR shot/control-point rows, quality flags, independent elevations, differences, or error metrics were obtained. Therefore median absolute difference, RMSE, maximum difference, terrain-spread tolerance, and scientific validation remain **not available**. The next scientific step is to obtain a small quality-screened ODE/PDS point export and compare only after its coordinate/elevation semantics are checked against the product.

## Phase 12 — Spatial delivery decision

The existing processed grid is still a `(720, 1440)` Float32 array of relative surface height in meters, generated from `DN × 0.5`; the reference radius is not added. The Phase 10 report documents the product-specific simple cylindrical mapping, DE421 Mean Earth/Polar Axis body-fixed frame, positive-east longitude, pixel registration, and pixel-center equations:

```text
longitude_deg = (column - 719.5) / 4
latitude_deg  = (359.5 - row) / 4
```

These equations address array cell centers; they do not make the NPY a standard geospatial raster or independently validate the gridded values. No GeoTIFF, Earth EPSG code, invented lunar CRS, resampling, or geotransform was created. Instead, a separate PNG display derivative and provenance sidecar were generated for the coordinate-addressed research preview. Its metadata explicitly records that no GeoTIFF CRS is assigned and that independent validation, delivery-ready, validated-renderable, and map-ready flags are false.

### New display artifacts

- `data/processed/moon/lola/ldem_4_relative-height-preview.png` — 1,411,024 bytes; SHA-256 `058BF946ECF7F53D962661F2D7D076648C3FA0E565C50F9355E5FE7C56D3BFE0`; 1440 × 720 RGBA PNG.
- `data/processed/moon/lola/ldem_4_relative-height-preview.json` — sidecar with input/output checksums, dimensions, display range, palette, coordinate mapping, provenance, and explicit limitations.
- Display colors use the existing processed array's 1st–99th percentile range, −5320.5 to 5681 m; only colors clip. Input values are unchanged. The renderer walks each source row and sample in order, without flip, transpose, resampling, or reference-radius addition. Non-finite input values render transparent; the source array currently has 1,036,800 finite samples and no non-finite samples under its recorded processing.
- Reproduction with the isolated Python environment produced the same PNG SHA-256. No Python package was added to the TerraMatch Node project.

## Phase 13–14 — Rendering, API, and frontend

- Added `scripts/moon/render-lola-preview.py`, an offline, no-overwrite renderer that verifies the processed NPY hash and sidecar, checks expected dimensions/dtype, writes PNG plus metadata atomically, and does not alter the source array.
- Added `GET /api/moon/lola/preview`, served through the existing Moon API dispatcher. It returns sanitized display/provenance metadata and scientific-status flags, not local file paths. The actual PNG and NPY are static build assets; the NPY is fetched by the browser only when the user requests a coordinate sample, then SHA-256 checked against API metadata before parsing.
- `/moon` consumes the Moon API and shows the acquired LDEM_4 image as an **unvalidated research preview**, with product/source attribution, relative-height legend, percentile display clipping note, gridded/interpolated limitation, and coordinate-system explanation. It includes global, near-side, far-side, and separate north/south polar stereographic display controls. The polar views are PNG display reprojections, not GeoTIFFs or validated scientific layers.
- Clicking the coordinate view maps to a containing cell with the documented pixel-center equations and reports relative height in meters or `NoData / unavailable`; it does not label a GDR cell as an independent point measurement. The NPY asset hash and 720 × 1440 C-order Float32 declaration are checked before sampling.
- All 13 catalog families remain in the layer panel. None is reported as an operational validated/renderable layer. The one research display preview is counted separately from validated layer counts. Other 12 families remain unacquired and unprocessed.
- API map-config text now explains that the view has separate previews but no lunar tile service or validated layer. No fake tile URL or feature source was added.

## Phase 15 — Additional family acquisition status

No additional products were downloaded. The complete catalog remains registered, with current lifecycle state summarized below. “Validation adapter implemented” means a validator exists; it does not mean an unacquired product has been scientifically validated.

| Dataset family | Product selected | Source acquired | Pixel/file inspected | Decoded | Processed | Scientific validation | Delivery/renderable |
|---|---:|---:|---:|---:|---:|---:|---:|
| LOLA global topography (`moon-lola-global-topography`) | Yes | Yes — LDEM_4 V3.0 | Yes | Yes | Yes — relative-height NPY | Blocked; no independent point check | Research preview only; not a validated layer |
| Kaguya LALT (`moon-kaguya-lalt-global-topography`) | Yes | No | No | No | No | Not performed | No |
| LRO Diviner (`moon-lro-diviner-thermal`) | Yes | No | No | No | No | Not performed | No |
| LROC WAC (`moon-lroc-wac-imaging`) | No | No | No | No | No | Not performed | No |
| LROC NAC (`moon-lroc-nac-imaging`) | No | No | No | No | No | Not performed | No |
| Chandrayaan-1 M³ (`moon-chandrayaan1-m3-reflectance`) | Yes | No | No | No | No | Not performed | No |
| Clementine UVVIS (`moon-clementine-uvvis`) | No | No | No | No | No | Not performed | No |
| LOLA-derived illumination (`moon-lro-illumination`) | Yes | No | No | No | No | Not performed | No |
| Permanently shadowed regions (`moon-permanently-shadowed-regions`) | No | No | No | No | No | Not performed | No |
| LRO LEND (`moon-lro-lend-hydrogen`) | Yes | No | No | No | No | Not performed | No |
| GRAIL gravity (`moon-grail-gravity-models`) | Yes | No | No | No | No | Not performed | No |
| Mini-RF (`moon-lro-minirf-radar`) | Yes | No | No | No | No | Not performed | No |
| USGS Unified Geologic Map (`moon-usgs-unified-geology`) | Yes | No | No | No | No | Not performed | No |

The registry validator reports 13 registered, 1 acquired, 1 processed, 0 scientifically validated, and 0 map-ready/renderable datasets. Future acquisition order remains: USGS geology (smallest useful validated vector package after exact version/terms are confirmed), a separately selected Diviner product, LROC WAC, GRAIL, then other instrument-specific products. Product release, format, size, licensing, projection compatibility, and quality semantics must be verified before acquisition; registry entries alone are not acquired data.

## Phase 16 — Verification

### Commands and results

| Command/check | Result |
|---|---|
| `npm test` | Pass — 154 tests, 8 suites, 0 failures. Includes Mars/Earth regressions and Moon API/array tests. |
| `npm run check:web` | Pass — TypeScript web check. |
| `npm run moon:registry:validate` | Pass — valid registry; 13 families, 1 acquired, 1 processed, 0 validated, 0 map-ready; no registry errors. |
| `npx vite build --outDir .moon-phase16-build` | Pass — Vite production build in an isolated temporary output directory; temporary build output was removed after verification. Existing `web-dist` assets were not written. Vite reported the existing large MapLibre and React Three Fiber chunks (>500 kB); build completed. |
| `F:\terra-moon-tools\lola-venv\Scripts\python.exe scripts/moon/render-lola-preview.py --output <temporary PNG> --metadata <temporary JSON>` | Pass — deterministic reproduction matched preview PNG SHA-256 `058BF946…D3BFE0`; temporary verification files were removed. |
| Local HTTP smoke checks | Pass — `/moon`, `/api/moon/summary`, `/api/moon/datasets?offset=0&limit=13`, `/api/moon/layers?offset=0&limit=13`, `/api/moon/lola/preview`, PNG, and NPY returned HTTP 200. API reports 13 families, 1 acquired/processed, 0 validated, 0 validated-renderable, 1 separate preview; layer response has 0 renderable and 13 unavailable. PNG served as `image/png` (1,411,024 bytes); NPY served as 4,147,328 bytes. |
| Browser visual QA | **Not verified.** The available computer-use tool stopped before navigation because it could not determine the existing Windows browser URL with sufficient confidence. HTTP checks are not represented as browser QA. |

An initial attempt to pass `--outDir` through `npm run build:web -- ...` was parsed by npm/Vite as an entry path and failed with unresolved `.moon-phase16-build/index.html`. The direct Vite command above used the correct option and passed. No ordinary build wrote to `web-dist`.

### Earth and Mars regression boundaries

The test suite passed with existing Mars REMS and Earth reference behavior covered by the current tests. This work did not modify Mars modules/data or Earth source/reference data and did not change the existing Earth map implementation. No browser-based Earth/Mars visual regression is claimed.

## Limitations and next blockers

1. **Independent scientific check:** no quality-accepted RDR point export or other independent point reference was obtained; LDEM_4 is not scientifically validated.
2. **Delivery format:** the display is an equirectangular PNG plus coordinate sidecar, not a GeoTIFF or standard CRS-defined raster. No polar projection, map tile service, or spatially indexed feature service exists.
3. **Data scale/performance:** the build emits approximately 1.41 MB PNG and 4.15 MB NPY static assets. The NPY is requested only for coordinate sampling, but a future tile/range delivery design is needed before adding larger global products.
4. **Visual/browser QA:** desktop/mobile screenshots, console state, and browser interaction were not verified because the browser automation safety gate could not bind to a known URL. Re-run browser QA when a controllable browser session is available.
5. **Coverage:** the grid's global dimensions and finite values do not prove complete observed coverage; coverage fractions remain unknown.
6. **No further datasets:** 12 families remain metadata-only/unacquired; no additional source product was downloaded in this continuation.

## Files changed for this continuation

- `scripts/moon/render-lola-preview.py` — reproducible PNG display derivative generator.
- `data/processed/moon/lola/ldem_4_relative-height-preview.png` — real processed-data-derived preview image.
- `data/processed/moon/lola/ldem_4_relative-height-preview.json` — preview provenance and display/coordinate limitations.
- `src/moon/api.ts` — preview metadata endpoint and summary readiness distinction.
- `web/src/moon/moon-api.ts` — typed preview response and API call.
- `web/src/moon/lola-sample-reader.ts` — narrow NPY parser and documented coordinate-to-cell mapping.
- `web/src/moon/MoonMapView.tsx` and `web/src/moon/moon-map.css` — real preview rendering, legend, and sampled cell presentation.
- `web/src/MoonPage.tsx` — API-driven preview status and wording.
- `tests/moon-api.test.ts` and `tests/moon-lola-preview.test.mjs` — preview API, provenance, integrity, and coordinate-reading tests.
- `package.json` — includes the new LOLA preview tests in `npm test`; no dependency was added.
- `docs/reports/README.md` — link to this report.
- `docs/reports/moon-finalization-report.md` — this report.

No changes were made to the processed source NPY, its existing sidecar, original cache, Mars/Earth data, protected MapLibre assets, deployment configuration, production resources, or Git history. No commit, push, migration, or deployment occurred.

## Continuation: polar preview integration and final local checks

This continuation does not add or renumber a project phase. It records the remaining implementation and blockers requested after the original Phases 11–16 report.

### Completion assessment

| Requirement | Status | Evidence |
|---|---|---|
| Independent LOLA RDR validation | BLOCKED | No independent shot/control rows retrieved; no metrics calculated. The official ODE REST v2 documentation describes asynchronous job polling, but the live API request from this environment failed with `EACCES` / `fetch failed`. No query result was obtained. |
| GeoTIFF / standard geospatial delivery | BLOCKED | No safe independent GeoTIFF reader/CRS interoperability tool is installed (`gdalinfo`, GDAL, rasterio, pyproj unavailable). The existing `geotiff` JS dependency alone was not used to self-validate a standard lunar CRS. No GeoTIFF was created. |
| True north-polar projection | PARTIAL | A 700×700 spherical polar stereographic PNG display derivative and metadata sidecar were generated from the existing Float32 array. Shared forward/inverse transforms round-trip tested. Not a standard geospatial raster; not validated/map-ready. |
| True south-polar projection | PARTIAL | Same as north; distinct southern hemisphere equations, imagery, and metadata. |
| Browser visual QA | BLOCKED | Edge exposed the old locally rendered `/moon` state, but fresh capture after refresh failed twice with the Computer Use `FrameArrived timed out` / `window capture timed out` error. HTTP checks are reported separately and are not browser QA. |
| Remaining 12 Moon families | NOT STARTED | Registry retained; no additional lunar source files acquired. Outbound PDS/ODE fetch from the local execution environment is blocked by network `EACCES`. |
| Earth regression | PARTIAL | Existing Earth data and behavior tests pass; no fresh browser visual comparison was completed. |
| Mars regression | COMPLETE | Existing Mars REMS and Mars contract tests passed within the full suite; no Mars source/API changes were made. |
| Full test suite | COMPLETE | `npm test`: 157 passed, 0 failed (8 suites). |
| Isolated production build | COMPLETE | `npx vite build --outDir=.moon-final-qa-build --emptyOutDir` passed. The temporary directory was removed. `npm run check:web` passed. The full Nitro/Vercel packaging build was not run because its configured output paths are not isolated from existing generated/link state. |

### Polar display derivatives

The new renderer is `scripts/moon/render-lola-polar-previews.py`. It verifies the processed NPY SHA before reading it, leaves that NPY and sidecar untouched, and maps each output pixel center through spherical polar stereographic inverse equations to the source grid's containing cell. The projection uses the LDEM_4 sidecar's Moon radius and frame declarations, planetocentric latitude, east-positive longitude, 0°E origin, true scale at the pole, and a 50° latitude cutoff. Nearest-cell sampling is a display transformation, not an accuracy upgrade. Transparent area outside the projection cap is distinct from NaN source cells.

| Artifact | Size | SHA-256 | Status |
|---|---:|---|---|
| `data/processed/moon/lola/ldem_4_north-polar-preview.png` | 267,297 bytes | `AC9DE3AB1D5DFB0C03C7481595C6B6C8E4B1DFAFD3025219BDEBC302088C665A` | Real-array-derived display PNG; not GeoTIFF |
| `data/processed/moon/lola/ldem_4_north-polar-preview.json` | — | — | Projection/provenance sidecar, scientific validation and map-ready flags false |
| `data/processed/moon/lola/ldem_4_south-polar-preview.png` | 284,349 bytes | `EF1F6041EB474A19330B1CDBA948E1315989179DE2A02281BFDF7D21E5DCC2EB` | Real-array-derived display PNG; not GeoTIFF |
| `data/processed/moon/lola/ldem_4_south-polar-preview.json` | — | — | Projection/provenance sidecar, scientific validation and map-ready flags false |

Both images are 700×700 RGBA, use 5,000 m display pixel spacing, and sample the 720×1440 Float32 relative-height array. Each sidecar reports 201,012 pixel centers inside the 50° projection cap and 288,988 outside the cap; these are output-domain pixel counts, not lunar observation coverage. The source array was not altered. The output range colors are clipped to the source-derived 1st–99th display percentile range; values remain relative height in meters.

The `/moon` controls now switch to distinct polar images. Polar coordinate clicks are inverse-projected to longitude/latitude and then sampled from the same checksum-verified NPY. API metadata is fetched from `GET /api/moon/lola/polar-previews`; the returned paths do not expose local filesystem paths. The Moon summary reports three display previews (global, north, south), while validated/renderable map layers remain zero. All 13 registered families remain visible and the other 12 remain unavailable/unacquired.

### Independent validation and acquisition attempts

The ODE REST v2 manual provides a direct query route and asynchronous job polling; this means the service is not inherently restricted to an email-only workflow. However, no real RDR point rows or job result were available in this run. The prior live ODE request failed at transport with `TypeError` (`cause.code=EACCES`, `message=fetch failed`) and the official dynamic endpoint was inaccessible through the web retrieval tool. This confirms a network-access blocker for this environment, not that the dataset itself is unavailable. Do not derive “independent” points from LDEM_4 itself. Required next evidence: a real ODE/PDS RDR export with coordinates, quality fields, elevations, product IDs, and compatible coordinate/elevation semantics.

No extra products were downloaded. The live outbound acquisition path was unavailable from this shell with network `EACCES`; accordingly all non-LOLA families remain unacquired. Use the exact source identifiers and candidate product/version values in `src/moon/registry/dataset-registry.ts`; values marked unknown there remain unknown. Registry validators do not promote those records to acquired.

### Current inventory — all 13 registry families

“Validation implemented” below denotes code availability only. It is not scientific validation. The LOLA checksum is the registry's acquired source checksum; the processed NPY and display artifacts have their own separate hashes recorded in their sidecars/tests.

| Family / registry ID | Official source and selected product/version | Acquisition / processing / scientific validation / map status | Local artifact / checksum |
|---|---|---|---|
| LOLA topography — `moon-lola-global-topography` | [PDS LOLA GDR](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2); `LDEM_4` V3.0 | acquired; processed relative-height grid; validation blocked; PNG research preview only | `data/processed/moon/lola/ldem_4_height_m.npy`; source SHA `9193828F…167FE3`; processed SHA `6D750B31…5123D417` |
| Kaguya LALT — `moon-kaguya-lalt-global-topography` | [JAXA/ISAS DARTS](https://darts.isas.jaxa.jp/missions/kaguya/faq.html); `SLN-L-LALT-5-TOPO-GGT-NUM-V2.0` V2.0 | not acquired; not processed; not validated; unavailable | None; checksum none |
| Diviner — `moon-lro-diviner-thermal` | [NASA PDS](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-DLRE-5-GCP-V1.0); `LRO-L-DLRE-5-GCP-V1.0` V1.0 (separate polar products not acquired) | not acquired; not processed; not validated; unavailable | None; checksum none |
| LROC WAC — `moon-lroc-wac-imaging` | [LROC release page](https://www.lroc.im-ldi.com/news/1497?tag=PDS+Release); exact selected product/version not selected | not acquired; not processed; not validated; unavailable | None; checksum none |
| LROC NAC — `moon-lroc-nac-imaging` | [NASA PDS LROC](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LROC-2-EDR-V1.0); exact selected product/version not selected | not acquired; not processed; not validated; unavailable | None; checksum none |
| Chandrayaan-1 M³ — `moon-chandrayaan1-m3-reflectance` | [NASA PDS](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=CH1-ORB-L-M3-4-L2-REFLECTANCE-V1.0); `CH1-ORB-L-M3-4-L2-REFLECTANCE-V1.0` V1.0 | not acquired; not processed; not validated; unavailable | None; checksum none |
| Clementine UVVIS — `moon-clementine-uvvis` | [PDS archive volume info](https://pds.nasa.gov/data/clem1-l-u-5-dim-basemap-v1.0/cl_3006/document/volinfo.pdf); `CLEM1-L-U-5-DIM-UVVIS-V1.0` candidate, selected files unverified | not acquired; not processed; not validated; unavailable | None; checksum none |
| LOLA-derived illumination — `moon-lro-illumination` | [NASA GSFC PGDA product 69](https://pgda.gsfc.nasa.gov/products/69); exact product ID/version unverified | not acquired; not processed; not validated; unavailable | None; checksum none |
| Permanently shadowed regions — `moon-permanently-shadowed-regions` | [NASA GSFC PGDA product 69](https://pgda.gsfc.nasa.gov/products/69); no single product selected | not acquired; not processed; not validated; unavailable | None; checksum none |
| LEND — `moon-lro-lend-hydrogen` | [NASA PDS](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LEND-4%2F5-RDR-V1.0); `LRO-L-LEND-4/5-RDR-V1.0` candidate V1.0 | not acquired; not processed; not validated; unavailable | None; checksum none |
| GRAIL gravity — `moon-grail-gravity-models` | [NASA PDS bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Agrail_gravity_derived); `grail_gravity_derived` 1.0 candidate | not acquired; not processed; not validated; unavailable | None; checksum none |
| Mini-RF — `moon-lro-minirf-radar` | [NASA PDS bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Alro_minirf_globalmosaic&version=1.0); `lro_minirf_globalmosaic` 1.0 candidate | not acquired; not processed; not validated; unavailable | None; checksum none |
| USGS Unified Geologic Map — `moon-usgs-unified-geology` | [USGS Astrogeology GIS v2](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/); 1:5M, 2020 GIS v2 candidate | not acquired; not processed; not validated; unavailable | None; checksum none |

The candidate products in the registry are not proof that source files, licenses, redistribution permissions, or file-level metadata have been verified. The high-value next source investigation is to obtain a small, exact USGS GIS package and separately review its terms, package contents, CRS metadata, and checksum before any acquisition state change.

### Files changed by this continuation

- `src/moon/coordinates.ts` — shared spherical polar forward/inverse coordinate transforms.
- `src/moon/api.ts` — serves sanitized north/south preview metadata and counts three display previews, while retaining zero validated/renderable layers.
- `web/src/moon/moon-api.ts` — polar response contract and API accessor.
- `web/src/MoonPage.tsx` — loads and passes the polar-preview API response.
- `web/src/moon/MoonMapView.tsx` — separate north/south projected views, graticules, and inverse-projected click sampling.
- `web/src/moon/moon-map.css` — square responsive polar viewport and metadata-missing fallback.
- `web/src/moon/lola-sample-reader.ts` — exports the shared polar hemisphere type.
- `scripts/moon/render-lola-polar-previews.py` and the four polar PNG/JSON outputs listed above.
- `tests/moon-api.test.ts`, `tests/moon-lola-preview.test.mjs` — polar API state, artifact integrity, projection round trips, seam/pole and invalid coordinate tests.
- `docs/reports/moon-finalization-report.md`, `docs/reports/README.md` — continuation results and index.

### Exact local verification for this continuation

| Command/check | Result |
|---|---|
| `npm test` | Pass: 157 tests, 8 suites, 0 failures. |
| `npm run check:web` | Pass: no TypeScript errors. |
| `npm run moon:registry:validate` | Pass: 13 registered, 1 acquired, 1 processed, 0 validated, 0 map-ready, 0 registry errors. |
| `npx vite build --outDir=.moon-final-qa-build --emptyOutDir` | Pass; generated the current client and included both polar images. Output directory removed after the check. The build reports large MapLibre (1.1 MB) and React Three Fiber (918 kB) chunks. |
| `npm run dev` | Build and web type-check passed, but its API child could not bind the already occupied port 8787 (`EADDRINUSE`). No existing listener was terminated. A separate local API instance on port 8788 was started for the current source smoke checks. |
| HTTP smoke (`127.0.0.1:8788`) | `/api/moon/summary`, `/api/moon/datasets?offset=0&limit=13`, `/api/moon/layers?offset=0&limit=13`, `/api/moon/lola/preview`, `/api/moon/lola/polar-previews`: all returned JSON 200. Summary: 13 registered, 1 acquired, 0 validated, 0 renderable, 3 research previews; layer catalog: 0 renderable / 13 unavailable; polar metadata identifies north and south and reports mapReady false. |
| Vite dev image HTTP checks (`127.0.0.1:5173`) | Both source PNG assets returned `image/png` HTTP 200. |
| Browser visual QA | Not completed for the updated screen; Computer Use screenshot capture failed after refresh with the errors above. No console/network assertions or screenshots are claimed. |

The initially attempted npm argument form `npm exec vite -- build --outDir ...` failed because npm forwarded the option as an entry path; the direct `npx vite build --outDir=.moon-final-qa-build --emptyOutDir` invocation passed. No build targeted `web-dist`; the two pre-existing modified MapLibre bundles were left untouched by this continuation. No commit, push, branch change, deployment, database operation, or production setting change occurred.
