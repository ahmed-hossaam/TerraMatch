# M5 — Final release readiness

## Executive result

M5 closes the known comparison-head eligibility defect without replacing the historical run. A new comparison run is archived and is now the current `latest.json` head. It uses the versioned M1 point-eligibility policy and contains 24 eligible references, not the complete 31-record archive. All 31 references remain in the archive and explorer.

- Current comparison: `12a38aaa-dcec-4be6-9222-6e0e8d6da857` (96 candidate/reference pairs; 4 candidates × 24 eligible references).
- Historical comparison retained unchanged: `626a4e76-042f-4539-8626-b9fc1a7bfb31` (124 pairs, full 31-record archive, predates curation eligibility).
- An earlier M5 policy-filtered run `a2e6b612-c76d-4903-952a-8456ff44f7cf` remains archived; the current run supersedes it by adding explicit discovery-policy lineage metadata.
- Current discovery head retained: `ca4250f9-7379-4fc1-af43-d0bd955ed68a`. It is a legacy run without M1 selection metadata. The new comparison references this discovery run but applies the M1 policy to the reference set. The application labels legacy discovery runs visibly. New discovery scripts now write M1 policy ID and version `1.0.0` into new run metadata.

## Inventory

- 31 reference records: 26 original atlas records and 5 supplementary records.
- 3 separate test fixtures.
- 19 evidence factors and 589 factor registry rows.
- 199 supplemental acquisition records: 195 USGS Meteor Crater entries and 4 GEOROC entries.
- M1 curation: 24 `keep_with_limitations`, 4 `region_only`, 3 `exclude_pending_review`, 0 `keep_verified`.
- 24 point-comparison-eligible references; excluded IDs are DEV, GOB, MDV, LAN, SVA, SEM, and LUT.

## Outcome and limitations

Discovery remains a bounded evidence-presence workflow, not scientific site discovery. The stored demonstration has 4 configured cells: 1 masked and 3 evaluated; all 3 evaluated candidates remain insufficient evidence. Their archived NASA POWER and GLiM outcomes are successful, while terrain retrieval failed. The new comparison reports factor-by-factor evidence and does not calculate suitability, similarity, ranking, or confidence.

The reference library keeps all 31 records, curation status, point eligibility and evidence limitations visible. MET and ETN supplemental chemistry remains non-point evidence and is not used as comparison input. See [scientific-limitations.md](./scientific-limitations.md).

## Readiness decision

The frontend builds and the API integration tests pass. Current reference eligibility is enforced for new comparison runs and recorded in their outputs; legacy discovery records are labeled in the UI. TerraMatch is ready to demonstrate evidence organization, bounded screening and transparent factor comparisons as a research prototype. It is not ready to claim validated Mars analogs or mission suitability. Browser automation was not run in M5; navigation, loading/error states and responsive styling were inspected in source, and API contracts were integration-tested.

See [validation-report.md](./validation-report.md) for command results, preservation checks and known build warnings.
