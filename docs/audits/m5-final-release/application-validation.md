# Application validation

## User-facing flows inspected

- **Landing/navigation:** English Mars-first landing, workspace navigation and scope labels are present; routes remain defined for Explore, References, Discover, Runs, Compare, Methodology, Candidate, Historical Discovery and Report.
- **Discovery:** Mission profile and bounded study-area configuration are backed by API-provided records; job lifecycle shows actual stage status and errors. A grid candidate is described as approximate and not a discovery.
- **Candidate details:** Shows provider status, climate period/coverage, GLiM classification, DSM caveat, required/optional mission factors, evidence dimension, provenance/source note and limitations. Historical runs without M1 metadata now show a legacy warning.
- **Reference archive/details:** API returns all 31 known references, curation dispositions, point eligibility and evidence coverage; fixtures remain separate. MET/ETN supplemental views expose the contextual data while explicitly excluding them from point comparison.
- **Comparison/details:** Current API head is the new 24-reference comparison. Factor statuses and methods are exposed; non-compared factors remain unavailable/failed. Legacy comparison runs without selection metadata show a warning in the matrix and report/PDF view. The current comparison also warns that its source discovery run predates M1 eligibility metadata.
- **Reports:** Candidate/reference filters are applied to report pair selection; the regression suite covers filtering. The PDF is descriptive, not a suitability verdict.
- **Empty/error/loading:** `useLoad` exposes API errors and loading state, empty evidence has explanatory text, job/API failures are not presented as success.
- **Themes/responsive behavior:** Existing dark/light theme control remains. CSS includes breakpoints at 1050/760 px, map/workspace single-column changes, reduced-motion handling and print rules. Static CSS/source inspection only; no device/browser visual E2E run was performed.

## API and route checks

`npm test` exercises the local HTTP API, CORS, project summary, 31-reference archive, curation/evidence endpoints, M2 supplemental views, study-area/profile payloads, new 24-reference comparison head, candidate detail response, invalid paths and job errors. Direct SPA route handling remains in the existing server fallback; no routing configuration was changed in M5.

The candidate API now includes the discovery run’s `referenceMasking` metadata (null for older records), allowing the UI to distinguish legacy runs. New discovery generation writes the M1 policy identifier and version `1.0.0`. New comparison generation includes the same identifier/version and the exact excluded list.

## Heavy modules and responsive behavior

MapLibre is dynamically imported when the map mounts. Three.js planet modules were lazy-loaded but the workspace planet scene was mounted on every workspace route. M5 now mounts that animated scene only on `/explore`; other workspace pages retain their CSS space background. This avoids loading the Three.js scene for the reference, discovery, run, comparison, and methodology routes. The production build still emits separate large vendor chunks, documented in the validation report.
