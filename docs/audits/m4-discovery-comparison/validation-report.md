# M4 validation report

## Commands run and results

| Command | Result |
|---|---|
| `npm test` | PASS — 79 tests, 0 failures, after final code changes |
| `npm run check:web` | PASS — frontend TypeScript check |
| `npm run build:web` | PASS — Vite production build; large MapLibre (about 1.1 MB) and Three.js/react-three-fiber (about 0.9 MB) chunks warned |
| `npm run build:evidence` | PASS — preserved/rebuilt the M3 evidence registry from source; 31 references, 3 fixtures, 19 factors, 589 factor evidence rows, 199 supplemental rows |
| `npm run validate:evidence` | PASS — 31 references, 3 fixtures, 19 factors, 589 factor rows, 199 supplemental rows; no errors |
| `npm run validate:data` | PASS — 26 known-site records and 3 candidate/fixture records validated |
| `npm run validate:discovery` with `DISCOVERY_VALIDATION_OUTPUT=docs/audits/m4-discovery-comparison/discovery-validation.json` | PASS — current stored run `ca4250f9-7379-4fc1-af43-d0bd955ed68a`, 4 cells, 3 insufficient-evidence, 1 overlap-rejected, 31 references, 3 fixtures; no errors |
| `npm run validate:comparison` with `COMPARISON_VALIDATION_OUTPUT=docs/audits/m4-discovery-comparison/comparison-validation.json` | PASS structurally — stored run `626a4e76-042f-4539-8626-b9fc1a7bfb31`, 124 pairs, 31 references, 3 fixtures; no structural errors. The legacy run has no curation-selection metadata and includes 7 currently ineligible references, as detailed below. |
| `npm run validate:mission-profiles` with `MISSION_PROFILE_VALIDATION_OUTPUT=docs/audits/m4-discovery-comparison/mission-profile-validation.json` | PASS — 5 dimensions, 19 factors, 4 missions; profile is planning-only and benchmark not scientifically validated |
| `npm run validate:reference-sites` with `REFERENCE_VALIDATION_OUTPUT=docs/audits/m4-discovery-comparison/reference-sites-validation.json` | PASS — original 26 + 5 supplements = 31; 3 fixtures remain separate |

The named environment variables route generated validator reports into this M4 folder instead of overwriting existing validation reports.

## Historical artifact integrity

No discovery or comparison run was regenerated. Before and after the M4 work, the SHA-256 hashes were unchanged:

- `data/processed/discovery-runs/latest.json`: `ff9d88ea7ca007de983e535185c8e54ab7f3e9ffae9e4e34788efab0c078c6ab`
- `data/processed/comparison-runs/latest.json`: `0f63a5c71f83483cdb1d342f21db6652b573da9e9b60a12acbff215828cb7d31`

The archived discovery head records the curation policy and validates against it. The archived comparison head predates M1 comparison eligibility: `referenceSelection` is null, it contains all 31 archive records, and includes DEV, GOB, MDV, LAN, SVA, SEM, and LUT, which current M1 rules exclude from point comparison. Its structural validation is not a curation-eligibility validation. Historical artifacts were intentionally preserved; do not treat those seven pairs as eligible point comparisons.

M4 did not modify the original atlas, M1 curation manifest, 31 reference records, 3 fixtures, 19 factor definitions, 199 supplemental record IDs/values, raw acquisition payloads/manifests, or historical discovery/comparison runs. The evidence build was run because required; it rebuilt generated M3 registry/coverage outputs from the preserved inputs.

## What changed

- Tightened discovery evidence availability checks and output validation.
- Added mission objective and required/optional factor details to newly generated candidate results.
- Added mission dimension and concise evidence explanation to candidate details UI, plus a warning on legacy comparison screens and PDF reports when M1 eligibility metadata is absent.
- Tightened climate and elevation comparison gates, and point-reference filtering in direct comparison calls.
- Added focused discovery/comparison regression tests.
- Added M4 audit and validation documents.

## What did not change

- No source data, scientific values, curation decisions, external retrieval, discovery/comparison archive head, API route, schema version, or hosting configuration was changed.
- No score, ranking, confidence, or suitability result was introduced.

## Remaining limitations and safe-use assessment

- **Discovery:** The current stored run is safe to read as a bounded, archived evidence-presence demonstration with explicit limitations. It does not establish analog status or mission suitability. Three evaluated candidates lack required factors and one grid cell is masked.
- **New comparisons:** The production comparison script selects M1 point-eligible references; the engine now guards coordinate-free and explicitly excluded records. Factor comparisons remain strictly source-compatible and descriptive.
- **Current historical comparison head:** It is structurally valid but not safe to interpret as M1-eligible point comparison for seven references. Generating a current, policy-filtered comparison would create a new run; M4 left the historical head unchanged per preservation requirements.
- NASA POWER is gridded/model-derived, Copernicus GLO-30 is a DSM pixel sample, and GLiM is generalized lithology. Provider availability and location representativeness remain factor-specific.
- Vite emits large lazy-loaded vendor chunk warnings. This is not a build failure.
