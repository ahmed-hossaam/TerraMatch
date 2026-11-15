# Final Browser Smoke QA

**Date:** 2026-11-15  
**Scope:** Local browser smoke test of the existing TerraMatch application. This was a manual browser check using Microsoft Edge and the installed Windows UI automation tool. It was not an automated E2E suite.

## Outcome

The main landing, workspace, reference, discovery, candidate, comparison, methodology, run-history, and report routes render from the current checkout. The selected comparison run is present and contains 24 currently eligible reference records across 96 candidate/reference pairs. All seven references excluded by the current point-comparison policy are absent from that comparison inventory.

A focused frontend correction was made after observing reference records where the unified evidence registry and M1 curation overlay recorded provider-backed evidence, while the archive/map/detail summaries relied only on legacy summary fields and displayed “Unavailable.” These summaries now recognize existing `primary_dataset` and `derived_value` evidence statuses. This changes only presentation/filter status; it does not alter data, comparison calculations, eligibility, or archived runs.

## Routes tested

All routes below were opened directly in Edge on an isolated local Vite/API pair (`http://127.0.0.1:15173` frontend, `http://127.0.0.1:18787` API). Direct route loads and a hard refresh were checked; links were present in the interface. A full click-through journey was not possible because the UI automation runtime could not click elements without coordinate geometry.

| Route | Result |
| --- | --- |
| `/` | Landing page rendered with workspace entry links, current inventory counts, the Atacama demonstration label, source descriptions, and scientific limitations. |
| `/explore` | Map workspace rendered 33 of 33 mapped records: 29 point/area references, 2 region records without pins, and 4 candidate grid cells. Map feature labels and attribution appeared; region-level records were not assigned pins. |
| `/references` | Archive reported 31 records, with search/filter controls, curation dispositions, and links to reference details. |
| `/references/GKC` | Detail rendered M1 `keep_with_limitations`, dimension-level curation evidence, citations, unified factor states, approximate-coordinate disclosure, and source/product limitations. Provider-backed climate, lithology, and terrain were available in unified evidence. |
| `/discover` | Mission profile and readiness rendered. The extreme-environment profile describes six required climate factors; the four-cell Atacama demonstration bounds, request budget, masking rule, and limitations were visible. No discovery was launched. |
| `/runs` | Archived discovery and comparison runs rendered, including the current M08 run. |
| `/runs/discovery/ca4250f9-7379-4fc1-af43-d0bd955ed68a` | Historical discovery detail rendered four cells and the explicit legacy warning that M1 point-eligibility metadata was absent and masking may include references now excluded from point comparison. |
| `/candidate/CAND-ATACAMA-CLIM-000-001-S23.5000-W69.3000?run=ca4250f9-7379-4fc1-af43-d0bd955ed68a` | Candidate detail rendered after direct navigation and hard refresh. It showed `Insufficient Evidence`, approximate grid-cell center and cell bounds, current mission requirements, NASA POWER/GLiM evidence, Copernicus failure, and missing mineral/process evidence. It states the record is not a confirmed analog or suitability result. |
| `/comparison?run=12a38aaa-dcec-4be6-9222-6e0e8d6da857` | Requested run rendered as 96 candidate/reference pairs and 24 reference records. The current comparison policy is recorded. The page warns that its linked discovery source is legacy. The initial candidate selection is a masked cell and consequently shows unavailable factors; another candidate can be selected in the provided control. |
| `/methodology` | M01–M08 workflow, all four mission profiles, data-source character, and no-ranking limitations rendered. |
| `/report/12a38aaa-dcec-4be6-9222-6e0e8d6da857` | Report rendered all candidates and 1,824 factor rows with the legacy-discovery warning and interpretation caveats. Print/Save as PDF control was present; the print dialog was not opened. |

The API was also queried read-only to verify the comparison relationship and exclusions:

- Comparison run: `12a38aaa-dcec-4be6-9222-6e0e8d6da857`
- Linked discovery run: `ca4250f9-7379-4fc1-af43-d0bd955ed68a`
- References: 24; pairs: 96; candidates: 4
- Excluded point-reference IDs present in comparison: none (`DEV`, `GOB`, `MDV`, `LAN`, `SVA`, `SEM`, `LUT` all absent)
- The comparison uses `reference-curation-v1-point-eligibility` version `1.0.0`.
- The linked discovery run has no M1 eligibility metadata; the UI labels this relationship as legacy.

## Defects and fixes

1. **Provider-backed reference evidence shown as unavailable in archive and details.** Reproduced for GKC: `/api/references/GKC/evidence` had available climate factors, a GLO-30 sample, and GLiM evidence, but the ordinary reference summary fields had no linked period/classification and the UI displayed “No linked history,” “No mapped class available,” and unavailable indicators. The reference evidence filter and summaries now consider the existing M1 dimension statuses (`primary_dataset` / `derived_value`). Detail cards now say provider-backed records, mapped classification, or DSM sample is recorded when the curated evidence state supports that label. Unified evidence details continue to show individual factor status, period, source, value, and limitation.
2. **Stale API listener on default port during startup.** The normal `npm run dev` attempt could not bind port 8787 (`EADDRINUSE`); the already-listening process served an older reference API response without curation. It was not stopped because its owner was not established. The smoke test was continued on isolated ports against the checked-out source; the current API returned curation and the current frontend rendered it. This is an environment/process collision, not a source-code correction.

## Verification run

- `npm test` — **79 passed, 0 failed** across 8 suites.
- `npm run check:web` — **passed**.
- `npm run build:web` — **passed**; Vite reports large MapLibre and React Three Fiber chunks (>500 kB), but the app builds. These are existing optional map/scene dependencies.
- Browser route smoke — routes listed above actually loaded in Edge. No screenshot was captured; screenshot capture had timed out in the available desktop automation runtime.

## Not verified / remaining demonstration cautions

- This was not a full automated E2E test. The driver could read accessibility content and navigate to URLs, but element-click coordinates were unavailable. Landing-to-workspace click, map marker interaction, reference filters, candidate selector interaction, and theme switching were not fully exercised.
- Responsive/mobile behavior was not tested; browser interactions were performed in one desktop Edge window.
- The PDF print dialog and saved PDF output were not tested.
- No deliberate network/API outage was injected. Error and empty states were not comprehensively exercised.
- Screenshots are unavailable because browser screenshot capture timed out.
- The selected current comparison view defaults to the reference-overlap-rejected candidate and shows unavailable factors for that candidate. The comparison run still includes all four candidates in its pair matrix; a candidate with available evidence must be selected to inspect those factor comparisons.
- The current comparison correctly uses 24 M1-eligible references but links to a discovery run without M1 policy metadata. The page warns about that legacy discovery/masking. This was preserved; no historical run was regenerated or edited.
- The application remains dependent on the local JSON artifact/API runtime. This QA did not test the public deployment or live provider availability.

## Files changed in this QA

- `web/src/App.tsx` — use existing curation dimension evidence for reference availability summaries and filters.
- `web-dist/` — regenerated frontend output from `npm run build:web`.
- `docs/audits/final-browser-qa/README.md` — this report.

No scientific records, M1 curation entries, candidate/reference evidence values, or historical discovery/comparison run files were edited as part of this QA.
