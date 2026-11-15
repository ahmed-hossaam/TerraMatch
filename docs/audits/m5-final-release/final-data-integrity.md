# Final data integrity

## Authoritative counts

| Inventory | Count | Verification |
|---|---:|---|
| Original atlas-derived references | 26 | `npm run validate:reference-sites` |
| Supplementary references | 5 | Same validator; review and source records retained |
| Complete reference archive | 31 | Reference/evidence validators and API integration test |
| Separate test fixtures | 3 | Data/evidence validators; API excludes them from reference library |
| Mission dimensions | 5 | Mission profile validator |
| Evidence factors | 19 | Mission profile and evidence validation |
| Factor registry rows | 589 | Evidence validation |
| Supplemental acquisition records | 199 | Evidence validation; 195 USGS and 4 GEOROC |
| Current point-comparison-eligible references | 24 | M1 manifest and current comparison validation |

M1 disposition counts remain 24 `keep_with_limitations`, 4 `region_only`, 3 `exclude_pending_review`, 0 `keep_verified`. The current excluded point-reference IDs are DEV, GOB, MDV, LAN, SVA, SEM, LUT. They remain visible in the full archive and do not occur in the current comparison run.

## Comparison heads

- Current policy-filtered comparison: `12a38aaa-dcec-4be6-9222-6e0e8d6da857`; run archive at `data/processed/comparison-runs/12a38aaa-dcec-4be6-9222-6e0e8d6da857.json`, current head at `data/processed/comparison-runs/latest.json`.
- Preserved legacy comparison: `626a4e76-042f-4539-8626-b9fc1a7bfb31.json`. Its SHA-256 remains `0f63a5c71f83483cdb1d342f21db6652b573da9e9b60a12acbff215828cb7d31`.
- Current discovery head: `ca4250f9-7379-4fc1-af43-d0bd955ed68a`. It remains an archived pre-M1 run without eligibility metadata; new discovery runs now include the M1 policy ID and version. Its archived SHA-256 remains `ff9d88ea7ca007de983e535185c8e54ab7f3e9ffae9e4e34788efab0c078c6ab`.

An intermediate M5 run `a2e6b612-c76d-4903-952a-8456ff44f7cf` is also retained as an immutable archived run; the current run supersedes it with explicit discovery-policy lineage fields. The current comparison contains 96 pairs and records `policyId=reference-curation-v1-point-eligibility`, `policyVersion=1.0.0`, archive count 31, and seven excluded IDs. The validator checks the selected inventory against the live M1 curation manifest.

## Preservation evidence

The old comparison archive stayed byte-for-byte unchanged while `latest.json` advanced to the new run. The original atlas, raw USGS/GEOROC payloads, retrieval manifest, M1 curation overlay, reference archive, fixture file, mission profile and factor definitions were not edited. M2 raw-file hashes remain checked by the automated acquisition-integrity tests. Evidence registry build reproduced 31 × 19 factor rows and 199 supplemental records.
