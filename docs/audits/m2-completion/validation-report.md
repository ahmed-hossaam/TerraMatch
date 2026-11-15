# M2 Validation Report

**Validation date:** 2026-11-15. Reports were written to this directory for the reference/profile/discovery/comparison validators so their previous report artifacts were not overwritten.

## Results

| Check | Result |
|---|---|
| TypeScript backend compilation (`npm test` build step) | Passed |
| Automated suite | **75 passed, 0 failed** |
| Frontend type check (`npm run check:web`) | Passed |
| Frontend production build (`npm run build:web`) | Passed; Vite reports large MapLibre and React Three Fiber chunks (>500 kB minified). |
| Evidence build (`npm run build:evidence`) | Passed; 31 references, 3 fixtures, 19 factors, 589 base rows, 199 supplemental acquisitions, 155 matching rows. |
| Evidence validator (`npm run validate:evidence`) | Valid; 199 supplemental rows match normalized acquisitions; MET and ETN represented; 0 errors. |
| Record data validation (`npm run validate:data`) | Passed; original 26 known sites and 3 candidate fixtures valid. |
| External catalog adapter tests | **6 passed, 0 failed**, including failure/empty distinctions, parsing, location association, bounded imports and write-once raw storage. |
| Reference validation | Valid; 26 original + 5 supplementary = 31; fixtures 3 separate. Snapshot: `reference-validation.json`. |
| Mission-profile validation | Valid; 5 dimensions, 19 factors, 4 Mars mission profiles. Snapshot: `mission-profile-validation.json`. |
| Discovery validation | Valid; current latest run ID `ca4250f9-7379-4fc1-af43-d0bd955ed68a`, 4 cells/candidates, one reference-overlap rejection. Snapshot: `discovery-validation.json`. |
| Comparison validation | Valid; current latest run ID `626a4e76-042f-4539-8626-b9fc1a7bfb31`, 4 candidates × 31 references = 124 pairs. Snapshot: `comparison-validation.json`. |
| API integration tests | Included in full suite; passed, including MET 195 and ETN 4 supplemental record checks and no raw response text exposure. |

Current unified state count for the 589 factor rows: 80 available, 230 not retrieved, 278 unavailable, and 1 not representative. This includes the ETN regional contextual state and does not convert absence to zero. Supplemental acquisition rows remain separately counted (199).

The test command was rerun after correcting stale API assertions that still expected 75 MET supplemental rows and 79 total rows. Current assertions follow the actual source-derived count (195 MET + 4 ETN = 199). No live provider retrieval was run as part of final validation; raw payloads already acquired were reused.

The frontend build emits chunk-size warnings for MapLibre and React Three Fiber; build completes. This is not evidence of live provider availability. No browser E2E claim is made in this M2 task.
