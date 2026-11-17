# Phase 6 — Evidence Gaps and Scientific Regression QA

## Objective and Git state

Present the actual status and claim boundaries for every lunar dataset family, then verify Moon additions against existing Mars and Earth behavior.

- Branch: `backend-preview-integration`
- Starting commit for this phase: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`
- No branch switch, commit, push, deployment, database operation, migration, or environment change occurred.

## Evidence-gap experience

Added `/moon/evidence`, linked from `/moon`. It loads the 13-entry dataset catalog, summary, layers, and coverage API responses. The page renders one card per registered family with provider/instrument, product/release, product-selection state, metadata status, acquisition, processing, product-validation state, validation-adapter state, map delivery, geographic scope, nominal/effective resolution, temporal coverage, observed/valid coverage status, quality/uncertainty, variable semantics, source link/attribution status, and expandable limitations/coordinate/license metadata.

The UI distinguishes validation code being implemented from a product being validated. Product validation is shown as pending while no product has been acquired. Unknown coverage is shown as unknown; the page does not display inferred percentages.

Whole-Moon scope is visible, alongside global, near-global, polar, targeted, and unknown scope descriptions. Global scope is not presented as complete valid observations or uniform resolution. Source-specific claim boundaries explain that Diviner is not air temperature, reflectance is not direct assay, LEND hydrogen and radar signatures do not establish ice, illumination/PSR products are model-dependent, NAC is targeted, LOLA/LALT remain distinct, and USGS geology is interpreted 1:5M mapping. No suitability, analog, readiness, similarity, confidence, or ranking score is shown.

## All 13 dataset status results

Common current state for all entries: **acquisition `not_acquired`; processing `not_started`; product validation pending; map delivery `not_started`; license/redistribution `unverified`; not renderable.** The validation adapter exists, but none of these product files has been validated.

| Dataset ID | Declared geographic scope | Product selection | Metadata status |
|---|---|---|---|
| `moon-lola-global-topography` | Global | Selected | Partial |
| `moon-kaguya-lalt-global-topography` | Global | Selected | Partial |
| `moon-lro-diviner-thermal` | Global product family; GCP and polar PCP remain separate | Selected | Partial |
| `moon-lroc-wac-imaging` | Near-global family; selected footprint not verified | Not selected | Unknown |
| `moon-lroc-nac-imaging` | Targeted footprints | Not selected | Partial |
| `moon-chandrayaan1-m3-reflectance` | Near-global family; footprint coverage not computed | Selected | Partial |
| `moon-clementine-uvvis` | Global family; valid-data coverage unverified | Not selected | Unknown |
| `moon-lro-illumination` | South-polar product | Selected | Partial |
| `moon-permanently-shadowed-regions` | Polar products; no authoritative product selected | Not selected | Unknown |
| `moon-lro-lend-hydrogen` | Global orbital family; effective support unverified | Selected | Partial |
| `moon-grail-gravity-models` | Global model family; model degree not fixed | Selected | Partial |
| `moon-lro-minirf-radar` | Global mosaic family; per-band valid coverage unverified | Selected | Partial |
| `moon-usgs-unified-geology` | Global interpreted map | Selected | Partial |

Summary from the validated registry: **13 registered; 9 product selections complete; 10 metadata statuses partial and 3 unknown; 0 acquired; 0 processed; 0 product-validated; 0 map-ready; 0 renderable.** Registry-wide license/redistribution state is unverified. “Product selection complete” does not mean that exact files, archive size, license, masks, or all source metadata have been audited.

## QA and validation results

- `npm test`: **134 passed, 0 failed**.
- `npm run check:web`: passed.
- `npm run moon:registry:validate`: valid, 13 families; 0 acquired, 0 processed, 0 validated, 0 map-ready.
- `npm run validate:mars-rems`: valid; 335,521 source rows, 249,657 accepted samples, 85,864 rejected samples; 8 Earth reference comparisons and 4 mission gaps.
- `npm run validate:data`: valid; 26 known records and 3 separate candidate fixtures.
- `npm run validate:reference-sites`: valid; 31 combined references, 5 accepted supplements.
- `npm run validate:mission-profiles`: valid; Mars profile retained with 5 dimensions, 19 factors, 4 missions, 31 references, 3 fixtures.
- `npm run validate:evidence`: valid; 31 references, 3 fixtures, 19 factors, 589 evidence rows, 199 supplemental records.
- `npm run validate:discovery`: valid latest stored run `eb788a2d-c9a7-49b9-94b4-557254d3dc93`; 1 candidate, 31 archive references, 3 fixtures.
- `npm run validate:comparison`: valid latest stored run `53633878-2abe-4deb-a880-b3153fcd4be7`; 24 eligible references, 24 pairs, 3 fixtures.
- `npm run build:vercel`: passed; Vercel/Nitro output generated, workflow compiled as 24 steps. Existing large MapLibre and Three.js chunk warnings remain.
- Browser/screenshot test: **not performed**. CSS breakpoints and responsive structure were added, but rendered desktop/mobile behavior is not verified.

Validation reports were directed to temporary, uniquely named paths where the scripts support output overrides and those temporary reports were removed after the checks. No existing discovery/comparison run or validation artifact was intentionally rewritten.

## Mars and Earth regression outcome

The test suite continues to exercise the Mars REMS API and artifact contracts, Earth reference API and evidence, Earth point eligibility, existing discovery/comparison APIs, and existing routes. Validators passed without changing Mars REMS, Earth references, M1 curation, evidence, or historical runs. Lunar observations were not inserted into Earth reference records.

## Files created or modified in this phase

- Created: `web/src/MoonEvidencePage.tsx`, `web/src/moon/moon-evidence.css`, `tests/moon-evidence.test.ts`.
- Modified: `web/src/App.tsx`, `web/src/MoonPage.tsx`, `tests/moon-map.test.ts`.
- Reports: this file and `docs/reports/README.md`.

## Unverified behavior and remaining blockers

- No browser-rendered QA was performed; route compilation is verified by TypeScript and the production build, while visual presentation, mobile overflow, and interactive disclosure behavior still need a browser check.
- No lunar files are acquired. Exact file-level format/size, license, nodata/QC masks, coordinate metadata, coverage computation, and product-specific processing remain prerequisites to scientific map layers.
- No Moon mission profile or Earth–Moon comparison is implemented. No global lunar tile/feature delivery exists.
- Existing production build warnings about large MapLibre/Three.js chunks remain.

No deployment or migration occurred.
