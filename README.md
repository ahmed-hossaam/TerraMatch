# Earth Analog Discovery Engine

An early scientific data-engineering prototype for exploring terrestrial environments relevant to Mars missions. It keeps known atlas sites separate from test fixtures, preserves source provenance and uncertainty, and never treats a high similarity value as scientific confirmation.

## Current status

- **Application layer — implemented; production build and API integration verified.** A React/TypeScript/Vite client reads project artifacts through a bounded Node.js API. It includes the landing page, map workspace, reference library, discovery jobs, candidate evidence, comparison matrix, history, methodology, and print-to-PDF report. Browser-level E2E automation could not be completed in this environment; see [application setup and API](docs/application.md). The Atacama run remains a bounded demonstration, not a scientific discovery.

- **M01 — atlas audit and normalization: complete.** The source atlas has 26 known sites; normalized records, three test fixtures, audit output, and benchmark manifest are maintained separately from the original source.
- **M02 — NASA POWER: complete for the five-site prototype sample.** Real responses for GKC, GKB, WDE, KHA, and RTI are stored and normalized for 2001-01-01 through 2020-12-31. Each site has 100% daily coverage for T2M, T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, WS10M, and ALLSKY_SFC_SW_DWN. See [M02 progress](docs/progress/M02-nasa-power.md) and the retrieval report. This does not establish global coverage or site-level ground truth.
- **M03 — Copernicus DEM: complete for five sites.** Node.js `geotiff` range reads retrieved and validated GLO-30 DSM samples for GKC, GKB, WDE, KHA, and RTI (5/5). See [M03 progress](docs/progress/M03-copernicus-dem.md) and the [source note](docs/data-sources/copernicus-dem.md).
- **M04 — GLiM: complete for five sites.** Live GLiM v1.1 polygon queries returned one mapped feature at each of GKC, GKB, WDE, KHA, and RTI; five raw responses and normalized results validate. These are generalized map evidence at approximate atlas points, not field verification. See [M04 progress](docs/progress/M04-glim.md) and the [source note](docs/data-sources/glim.md).
- **M05 — mission profiles and blind benchmark planning: complete as a requirements artifact.** A versioned Mars surface profile, evidence availability matrix, and leakage-aware benchmark protocol are validated. No calibration/holdout split is defensible from the 31 heterogeneous positive references; no benchmark has been run or scientifically validated. No weights, scores, or rankings are generated. See [M05 progress](docs/progress/M05-mission-profiles-benchmark.md).
- **M06 — reference dataset: curated and reproducibly validated.** The original 26 atlas sites are unchanged. Five separately sourced supplements were accepted with evidence/granularity notes, yielding 31 combined references; three are point-area records and two are region-only. NASA POWER, Copernicus GLO-30, and GLiM were retrieved for all three point records (9/9 provider results). See [M06 progress](docs/progress/M06-reference-dataset.md).
- **M07 — bounded candidate discovery: implemented, with validation lifecycle.** The default demonstration is a versioned four-cell Atacama grid with a 75 km point-reference mask and a 12-request ceiling. Cell bounds and sampling centers are distinct; one cell is masked in the current output. The latest live attempt records failed NASA POWER, Copernicus, and GLiM requests for the other cells because outbound provider requests returned `fetch failed` in this environment. All required mission evidence is therefore missing. Earlier archived runs retain real provider successes and failures; neither those records nor any status confirms analog validity. See [M07 progress](docs/progress/M07-candidate-discovery.md).
- **M08 — evidence comparison matrix: implemented with temporal summaries.** The current four-candidate run is paired with all 31 references (124 pairs). With current provider failures, factors are failed or unavailable; values are not imputed. Compatible daily histories also include calendar-season and year-stratified means with valid/missing counts and coverage. No overall score, ranking, confidence, or “best analog” conclusion is generated. See [M08 progress](docs/progress/M08-evidence-comparison.md).

The existing `climate_mars_score` is a legacy climate-only atlas field. It is not used as an overall score. No mission score, overall similarity score, or scientific confidence score is calculated. The supplied research document is scientific context, not a numerical dataset.

NASA Space Apps Global Offers evaluation is documented in [the evaluation](docs/data-sources/global-offers-evaluation.md). Planetary Computer is deferred for a later access/workflow test; Meteomatics is not needed unless an identified data gap justifies evaluating its credentialed service.

## Prerequisites and installation

- Node.js 20 or later and npm.
- TypeScript 5.8+ (declared development dependency).
- `geotiff` 3.0.5 is required for Copernicus COG extraction and is declared as a runtime dependency.

```sh
npm install
```

The TypeScript pipeline does not require a database. NASA POWER and GLiM use native `fetch`; neither integration needs credentials. Copernicus uses `geotiff` to read remote COG ranges. The dependency is declared in `package.json` and `package-lock.json`.

## Commands

```sh
npm.cmd test                       # deterministic tests; no live network required
npm.cmd run check:web              # strict TypeScript check for React application
npm.cmd run build:web              # build the web client
npm.cmd run build:app              # compile backend, type-check web, and build frontend
npm.cmd run dev                    # local Vite app + API (Ctrl+C stops both)
npm.cmd start                      # serve built app and API on 127.0.0.1:8787
npm.cmd run audit:atlas            # rebuild M01 normalized outputs and audit
npm.cmd run validate:data          # validate M01 normalized JSON
npm.cmd run rebuild:nasa-power     # normalize/validate stored M02 raw responses, no network
npm.cmd run retrieve:nasa-power    # retrieve configured known-site climate responses
npm.cmd run retrieve:copernicus-dem # extract COG samples then normalize (requires geotiff and public HTTPS)
npm.cmd run validate:copernicus-dem # normalize existing raw samples and write report
npm.cmd run retrieve:glim          # query GLiM polygons for configured known sites
npm.cmd run rebuild:glim            # normalize existing raw GLiM query responses
npm.cmd run validate:glim           # rebuild and write GLiM validation report
npm.cmd run validate:mission-profiles # validate versioned profile and benchmark protocol
npm.cmd run build:reference-sites    # build combined references without modifying the atlas
npm.cmd run validate:reference-sites # validate original and supplementary references
npm.cmd run retrieve:supplementary-evidence # try M02-M04 providers for point supplements
npm.cmd run discover:candidates      # run the configured bounded M07 workflow
npm.cmd run validate:discovery       # validate latest candidate run output
npm.cmd run compare:candidates       # compare latest candidates with combined references
npm.cmd run validate:comparison      # validate the latest factor-level comparison matrix
npm.cmd run build:app                # compile backend, type-check web, and build frontend
```

There is no automated browser E2E harness or `test:e2e` command in this checkout. A manual browser smoke check was performed against the running local app for the landing page, Explore map and configured cells, mission profile/readiness and area selectors, comparison matrix, candidate/reference-filtered report, region-level reference filtering, and dark/light theme toggling. It did not submit a new discovery job or exercise map panning/zoom; automated E2E remains unverified. The exact manual browser workflow and current limits are in [application documentation](docs/application.md).

### Run the application

After `npm.cmd ci`, run `npm.cmd run dev` and open `http://127.0.0.1:5173/`. The application consumes project artifacts through `/api/*`; the browser cannot read arbitrary files. To serve the production build locally, run `npm.cmd run build:app` then `npm.cmd start` and open `http://127.0.0.1:8787/`.

Use **New discovery** to choose a Mars mission and configured area. The default is a four-cell Atacama climate demonstration; the legacy single-cell v1 remains available. Before a run, the page lists required factors, actual integrations, unsupported factors, and source limitations. The API runs M07, validates the exact output, then runs and validates M08. A job is complete only after both validators pass. Provider failures remain part of the run. **Run history** opens archives, and **Comparisons → Prepare PDF report → Print / Save as PDF** applies the selected candidate/reference filters to the print report. See [application documentation](docs/application.md) for route and API details.

### Full data-backed demo from a clean checkout

This sequence assumes public network access. Provider failures remain visible in reports; do not treat a failed source as retrieved data.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run retrieve:nasa-power
npm.cmd run retrieve:copernicus-dem
npm.cmd run retrieve:glim
npm.cmd run retrieve:supplementary-evidence
npm.cmd run build:reference-sites
npm.cmd run validate:data
npm.cmd run validate:reference-sites
npm.cmd run validate:mission-profiles
npm.cmd run validate:copernicus-dem
npm.cmd run validate:glim
npm.cmd run discover:candidates
npm.cmd run validate:discovery
npm.cmd run compare:candidates
npm.cmd run validate:comparison
```

NASA POWER defaults to five sites, 2001-01-01–2020-12-31, and the seven parameters listed above. Configure `NASA_POWER_SITE_IDS`, `NASA_POWER_START`, `NASA_POWER_END`, and `NASA_POWER_PARAMETERS` in the environment. Raw response bodies are preserved under `data/raw/nasa-power/`; normalized daily values and retrieval reports are under `data/processed/climate/`.

Copernicus extraction defaults to the same five sites. Configure `COPERNICUS_SITE_IDS` and optionally `COPERNICUS_RAW_DIR`. Raw point samples are kept under `data/raw/copernicus-dem/`; normalized elevation samples and the validation report are under `data/processed/terrain/`. Valid raw samples are reused by default.

GLiM retrieval defaults to the same sites. Configure `GLIM_SITE_IDS`, `GLIM_RAW_DIR`, `GLIM_TIMEOUT_MS`, and `GLIM_RETRIES`. Raw point-in-polygon responses are kept under `data/raw/glim/`; normalized results and reports are under `data/processed/geology/`. Valid raw query responses are reused by default.

Reference expansion does not alter the atlas. `build:reference-sites` combines the 26 preserved records with five reviewed supplement records into `data/processed/reference-sites.json`; `validate:reference-sites` checks structure and counts. Use `SUPPLEMENTARY_SITE_IDS` to choose point-located supplements. Semail and Dasht-e Lut are region-level and skipped by point integrations.

Candidate search configuration is in `data/discovery/study-areas/atacama-bounded-test-v1.json`. Set `DISCOVERY_STUDY_AREA`, `DISCOVERY_MISSION_PROFILE`, `DISCOVERY_MISSION_ID`, `DISCOVERY_MAX_CANDIDATES` (1–100), `DISCOVERY_TIMEOUT_MS`, and `DISCOVERY_OUTPUT` as needed. Results are written separately under `data/processed/discovery-runs/`; candidate climate histories go under `data/processed/climate/candidates/`. The example is explicitly a pipeline test. Availability screening checks for non-null evidence only; it does not compare against Mars or rank candidates.

M08 comparison uses the latest discovery run and the authoritative `data/processed/reference-sites.json` set. It writes a compact factor-level matrix to `data/processed/comparison-runs/`; source histories remain in their existing climate/geology/terrain paths. The comparison command never reruns retrieval and does not produce a combined score.

## Data sources

- `أطلس المواقع المشابهة للمريخ (JSON).json`: 26-site reference atlas. Kept unchanged. Coordinates may be approximate; descriptive geology/mineral claims and the legacy climate-only score are not independently verified.
- `Mars_Analogues_Haneen_Ayman.json`: research document used as context only; it discusses Río Tinto, Atacama, Iceland Highlands, McMurdo Dry Valleys, astrobiology, and Earth–Mars limitations.
- Supplementary site review: `data/benchmarks/supplementary-site-review.json` records independent citations and location granularity for Dallol, Dalangtan, Semail, Gypsum Hill (Axel Heiberg), and Dasht-e Lut. The supplied research document itself does not contain these five site records.
- NASA POWER: real daily climate for the five original prototype sites plus DALL, DAL, and AHS-GH. Supplement histories cover 2001–2020 with 100% coverage for the seven configured parameters. These are gridded values, not field observations. Solar radiation is not UV.
- Copernicus DEM GLO-30: five original prototype samples plus three supplementary point samples, preserved raw and normalized as DSM pixel elevations with source metadata. See [source/access limitations](docs/data-sources/copernicus-dem.md).
- GLiM v1.1 ArcGIS Feature Service: five original prototype polygon records plus three supplementary point queries, preserving raw attributes and separate classification levels. These are generalized map results. See [service and classification limitations](docs/data-sources/glim.md).
- Planetary Computer and Meteomatics are not integrated.

## Layout

```text
src/types, src/schemas/       unified location and climate types/validation
src/data-sources/             NASA POWER, Copernicus DEM, and GLiM adapters
src/normalization/            atlas normalization and candidate fixtures
src/validation/               normalized-data validation
src/discovery/                bounded grid, provider orchestration, and evidence-availability screening
src/comparison/               source-compatible candidate/reference factor comparisons
scripts/                      audit, retrieval, ingestion, rebuild, validation
tests/                        deterministic unit tests
data/atlas/                   preserved source data (where supplied)
data/raw/                     external source responses (git-ignored)
data/cache/                   deterministic source caches (git-ignored)
data/processed/               normalized records and reports
data/discovery/               versioned bounded study-area configurations
data/benchmarks/              benchmark reference manifest
data/mission-profiles/         versioned mission requirements and evidence availability
docs/progress/                milestone implementation reports
docs/data-sources/            data-source evaluation and source notes
```

## Schema overview

Known sites and test fixtures share a normalized location structure. Retrieved climate is stored as linked date-indexed records with measurement values, units, source IDs, quality statuses, summaries, and coverage. Terrain elevation is kept separately with product, tile, coordinate reference, and provenance. Missing values remain null; mineral evidence is kept distinct from lithology. Similarity, coverage, and confidence are separate concepts.

## Deployment

The target hosting architecture is Vercel-only: the Vite frontend, Node API functions, and durable Discovery/Comparison Workflows run in the existing `terramatch` project. Neon PostgreSQL is intended for job and artifact metadata; the connected private Vercel Blob store is intended for durable artifacts. The root Vercel build verifies required deployment environment names and builds the full-stack app; data migration is a separate, explicitly invoked command and is not run automatically during Preview builds. Preview database isolation must be confirmed before invoking that migration or any write workflow. See [`docs/deployment/vercel-full-stack.md`](docs/deployment/vercel-full-stack.md).

## Current limitations

- M02 has daily histories for five original atlas sites and three accepted supplementary point-area sites; it is not global climate discovery. Coordinates are approximate and NASA POWER is gridded.
- M03 live extraction needs the declared `geotiff` package and public HTTPS access. Copernicus GLO-30 is a digital surface model, not guaranteed bare-earth elevation; extraction is elevation-only.
- M03 and M04 have point evidence for five original atlas sites and three supplementary point-area sites, not global terrain/lithology coverage. GLO-30 is a DSM; GLiM is generalized and not site-level field verification or mineral evidence.
- M07 uses a small bounded, versioned demonstration area. The most recent live provider attempt failed all three integrations in this network environment; earlier archives retain successful retrievals and failures. The current run's required evidence remains unmet. No global search or suitability claim is made.
- M08 compares every candidate with each reference; the current run has 4 × 31 = 124 pairs. Compatible NASA POWER histories receive descriptive distribution and calendar-season/year summaries. Failed and unavailable states remain explicit; outputs are not rankings.
- Two supplementary records are region-level and have no point coordinates. Three point-area supplements have data from the supported M02-M04 integrations, with approximate-coordinate limitations.
- Atlas descriptions and legacy values remain source claims, not independent scientific validation.

### Current artifact head

Treat `latest.json` and the matching validation reports as the artifact heads. Their execution IDs are generated and should not be copied into documentation; each validation report must match the run it describes. The authoritative reference dataset contains 31 records: 29 point-area references can be mapped, while Semail and Dasht-e Lut remain region-level. Candidate grid-cell polygons are derived from the selected configuration and remain distinct from center markers.

## Next steps

The scientific backend MVP is implemented through M08. Before any future ranking work, obtain expert review of comparison factors and independent calibration/holdout data; the current atlas is small, positive-only, and unevenly covered. No similarity algorithm has been scientifically validated.

