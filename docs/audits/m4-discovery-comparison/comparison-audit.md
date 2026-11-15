# Comparison audit

## Production selection

`run-comparison.ts` selects point-comparison references from the full archive using M1 `pointComparisonEligible` plus the allowed dispositions. It records the policy, archive size and excluded IDs. `createComparisonRun` now rejects any reference explicitly excluded by a declared policy. The lower-level comparison function also excludes coordinate-free records and honors a declared exclusion list. The validator checks the policy metadata and ensures excluded records do not occur in output pairs. The full archive remains separately available.

## Methods currently used

- **NASA POWER climate:** For daily distributions, candidate and reference histories must both be NASA POWER, have the same actual observation period, matching units, matching parameter/provider metadata, and valid finite observations. Missing observations remain excluded; quantile differences (25th, median, 75th) and valid/missing counts are descriptive. A summary-only fallback is allowed only when both histories contain no daily rows and each finite mean has a positive integer valid count and compatible unit. It reports only the mean difference and states that quantiles are unavailable. Histories must identify the compared candidate/reference.
- **Temperature range:** Derived per date only from valid daily temperature extrema or an explicitly valid stored range. Missing extrema are not imputed.
- **GLiM:** Compares exact classification codes only at the same level. Ambiguous polygons are surfaced as ambiguous; source “No Data” and placeholder codes are not compared. GLiM remains generalized mapped lithology, not field verification or mineral detection.
- **Elevation:** A point-sample difference is emitted only when both values have valid quality status and compatible meters, product, horizontal CRS, vertical datum, and nominal resolution. A DSM pixel is not mean elevation, slope, roughness, or terrain diversity.
- **Unsupported factors:** Mineralogy, geological processes, UV, terrain statistics and other factors without compatible evidence remain unavailable with explicit reasons. MET mount-average chemistry and ETN regional GEOROC rows are supplemental dataset-context records and do not enter point comparison factors.

No factor weights, overall score, ranking, confidence, or mission-suitability inference is calculated. The matrix describes data that meet each compatibility check, not scientific truth or analog validity. The current stored comparison contains 124 pairs (4 candidates × 31 archived references) and has no `referenceSelection` policy metadata. It includes seven references that the current M1 policy excludes from point comparison: DEV, GOB, MDV, LAN, SVA, SEM, and LUT. Its existing validator accepts this legacy schema, so “valid” confirms structural consistency, not current point-eligibility compliance. The historical artifact was not rewritten; do not treat its pairs involving those seven records as M4-approved point comparisons. New production runs use the current M1 point-eligibility selection.

## Confirmed corrections

- Summary-only climate comparisons now reject null/non-finite means and zero/invalid valid counts.
- Climate history location IDs must match the compared records.
- Unverified/legacy elevation values cannot enter the point difference calculation.
- Coordinate-free references and policy-excluded references cannot enter direct point comparison output.
- Declared policy exclusions are rejected at comparison-run construction if supplied as selected inputs.

## Remaining limits

Provider support is heterogeneous, and same-period climate summaries still describe gridded product outputs at requested coordinates rather than field measurements. Exact GLiM code equality is a categorical map comparison, not environmental equivalence. Elevation comparison is only a pixel difference. These results should be read factor by factor with their provenance and limitations.
