# M4 — Discovery and comparison reliability

## Scope

M4 audited the existing bounded discovery pipeline, mission-profile evidence gate, point-reference selection, comparison generation, API-backed candidate detail view, and validators. It made narrow reliability fixes and added regression tests. It did not retrieve provider data or regenerate discovery/comparison runs.

## Outcome

- Discovery and comparison remain descriptive, evidence-first tools. Neither emits an overall similarity score, ranking, confidence, or mission-suitability conclusion.
- The discovery screen now treats an `available` factor with a null or absent value as missing. It includes the mission objective and explicit required/optional factor states in newly generated results.
- Candidate evidence now carries its mission dimension, and the detail page displays the dimension, status, source, unit, and explanation.
- Climate comparison now checks history identity against the candidate/reference IDs and requires finite summary means with positive valid-observation counts. Existing daily observations continue to require matching provider, parameter, units, and periods.
- Elevation comparison requires valid quality status and compatible product, datum, CRS, resolution, and units.
- Direct comparison calls skip coordinate-free references and honor any declared exclusion list. Production run generation continues to select references using M1 eligibility.

## Validation snapshot

The current latest discovery head validated as `ca4250f9-7379-4fc1-af43-d0bd955ed68a` (4 candidates: 3 insufficient evidence, 1 overlap-masked). The current latest comparison head validated as `626a4e76-042f-4539-8626-b9fc1a7bfb31` (124 archived candidate/reference pairs, 31 references). The comparison validator reports 232 compared factor rows, 2,031 unavailable, and 93 failed. These counts describe this stored artifact, not a general evidence-coverage rate.

The automated suite passed 79 tests. Frontend type checking and production build passed. The production build reports large MapLibre and Three.js chunks. Evidence and data validation passed. See [validation-report.md](./validation-report.md).

## Limitations

Discovery screening is an evidence-presence gate, not scientific suitability. NASA POWER remains gridded/model-derived climate data; GLO-30 is a DSM point pixel; GLiM is generalized lithology. Comparison is restricted to compatible factor-level descriptions, with unsupported or incompatible factors unavailable. A missing provider response, an empty result, and a failed request remain distinct states. Historical artifacts retain their original schema and contents; newly generated runs contain richer explanations.
