# M5 validation report

## Final checks

| Command | Result |
|---|---|
| `npm test` | PASS — 79 tests, 0 failures |
| `npm run check:web` | PASS |
| `npm run build:web` | PASS; Vite warns about the MapLibre and Three.js vendor chunks (details below) |
| `npm run build:evidence` | PASS — 31 references, 3 fixtures, 19 factors, 589 factor rows, 199 supplemental records |
| `npm run validate:evidence` | PASS — all counts and provenance validations valid |
| `npm run validate:data` | PASS — 26 original normalized records and 3 fixtures valid |
| `npm run validate:discovery` with `DISCOVERY_VALIDATION_OUTPUT=docs/audits/m5-final-release/discovery-validation.json` | PASS structurally for legacy discovery `ca4250f9-7379-4fc1-af43-d0bd955ed68a`: 4 cells, 3 insufficient evidence, 1 overlap rejection, 31 archive refs. This run has no M1 selection metadata and the frontend labels it legacy. |
| `npm run validate:comparison` with `COMPARISON_REQUIRE_CURATION_POLICY=true` and `COMPARISON_VALIDATION_OUTPUT=docs/audits/m5-final-release/comparison-validation.json` | PASS against the current curation manifest and versioned policy: run `12a38aaa-dcec-4be6-9222-6e0e8d6da857`, 24 refs, 96 pairs, 0 excluded-reference pairs |
| `npm run validate:comparison` (standard head report) | PASS; refreshed `data/processed/comparison-runs/validation-report.json` to match the new head |
| `npm run validate:mission-profiles` with `MISSION_PROFILE_VALIDATION_OUTPUT=docs/audits/m5-final-release/mission-profile-validation.json` | PASS — 5 dimensions, 19 factors, 4 missions; benchmark remains planning-only and scientifically unvalidated |
| `npm run validate:reference-sites` with `REFERENCE_VALIDATION_OUTPUT=docs/audits/m5-final-release/reference-sites-validation.json` | PASS — 26 original + 5 supplements = 31; 3 fixtures separate |

The output variables above route audit evidence to this M5 directory. Discovery and comparison default head validation reports were also refreshed because the API summary uses them to report current-head status.

## New comparison run

Generated via `npm run compare:candidates`, which used the existing M1 selection function and current discovery head. The run used `COMPARISON_ARCHIVE_DIRECTORY=data/processed/comparison-runs`, `COMPARISON_LATEST_OUTPUT=data/processed/comparison-runs/latest.json`, and `COMPARISON_VALIDATION_OUTPUT=docs/audits/m5-final-release/comparison-generation-validation.json`. It created a unique run archive and advanced `latest.json`; it did not overwrite the old UUID archive.

- Run ID: `12a38aaa-dcec-4be6-9222-6e0e8d6da857`
- Discovery run ID: `ca4250f9-7379-4fc1-af43-d0bd955ed68a`
- Reference policy: `reference-curation-v1-point-eligibility`, version `1.0.0`
- Eligible reference count: 24; archive count: 31
- Excluded IDs: DEV, GOB, MDV, LAN, SVA, SEM, LUT
- Pair count: 96 (4 stored candidates × 24 eligible references)
- Factor states: 232 compared, 1,520 unavailable, 72 failed, 0 ambiguous, 0 missing
- No score, ranking, confidence, or suitability conclusion is present.

The new comparison is linked to the preserved legacy discovery head. The comparison uses current M1 eligibility for its reference set, but does not claim that the historical discovery mask used that policy.

## Historical preservation

The per-run historical comparison archive `626a4e76-042f-4539-8626-b9fc1a7bfb31.json` and the intermediate M5 comparison archive `a2e6b612-c76d-4903-952a-8456ff44f7cf.json` remain unchanged. The legacy archive remains byte-for-byte unchanged (SHA-256 `0f63a5c71f83483cdb1d342f21db6652b573da9e9b60a12acbff215828cb7d31`). The legacy discovery archive `ca4250f9-7379-4fc1-af43-d0bd955ed68a.json` remains unchanged (SHA-256 `ff9d88ea7ca007de983e535185c8e54ab7f3e9ffae9e4e34788efab0c078c6ab`). `latest.json` for comparison now points to the newly archived M5 run.

Preservation checks also confirmed unchanged hashes for `reference-sites.json`, `candidate-points.json`, and `reference-curation-v1.json`. USGS raw report and GEOROC raw CSV/TXT hashes match the repository integrity tests. Original Arabic source materials and acquisition files were not edited. The M1 decisions and 199 normalized supplemental record values/IDs were retained.

## Application and performance review

The API integration tests exercise the new 24-reference response, exact policy metadata, candidate evidence response, 31-record explorer archive, all supplemental evidence, and error handling. The app warns on historical comparison runs without a selection policy and on discovery/candidate views for historical runs without M1 metadata. Three.js workspace planets are now mounted only on Explore; other workspace routes retain the CSS space background. MapLibre remains dynamically imported when the map mounts. Responsive breakpoints and reduced-motion/print rules were inspected.

No browser E2E or device-based visual run was performed. Large output chunks remain: MapLibre about 1.1 MB and react-three-fiber about 0.9 MB minified. These are build warnings, not failures; the Three.js scene is route-gated, but its vendor chunk remains substantial when loaded.

## Remaining release limitations

- The stored discovery head remains a legacy M07 run without M1 policy metadata. No fresh provider run was made because it would repeat live retrieval and write candidate climate outputs under deterministic candidate IDs. New discovery script output now includes the current M1 policy ID/version and has a deterministic regression test.
- The archived demonstration has Copernicus terrain failures for each evaluated cell. NASA POWER and GLiM outcomes are recorded as successful for those cells.
- No scientific suitability score, analog confirmation, or mission ranking is validated or claimed.
- Browser/device E2E remains unverified.
