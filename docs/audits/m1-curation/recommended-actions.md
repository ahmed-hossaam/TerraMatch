# Recommended follow-up after M1

M1 ends with a reversible overlay and does not start M2.

| Priority | Action | Likely files | Dependency / risk |
|---|---|---|---|
| P0 | Review each atlas citation against its specific locality and claim; complete GOB/HIS and site-specific questions for all 31. | `data/curation/reference-curation-v1.json`, M1 citation report | Domain scientist review; do not promote based on a broad regional citation. |
| P0 | Establish one authoritative rule for point comparisons and apply it consistently to newly generated comparisons, while retaining full archive and historical runs. | `scripts/run-comparison.ts`, validator, comparison API | Current M1 `pointComparisonEligible` is surfaced and tested but does not rewrite historical matrices. A future filter changes pair counts and requires explicit schema/versioning. |
| P0 | Decide how region-only references appear in discovery masking and maps; avoid using a centroid as a point mask. | discovery exclusion logic, reference map layer | Must preserve historic outputs; explicit region geometry or no point exclusion required. |
| P1 | Replace Arabic source-value equality literals in application scripts with stable-ID/source metadata mapping. | `scripts/app-api.mjs`, `src/normalization/atlas.ts`, `scripts/audit-atlas.ts` | Verify atlas audit output remains semantically identical; preserve source values. |
| P1 | Extend reference validation to validate curation one-to-one IDs, decision enums, citation metadata and region/point-use rules. | `scripts/validate-reference-sites.ts` or new curation validator | Avoid coupling source validation to curation edits unless both reports identify exact versions. |
| P1 | Complete coordinate dossiers and quantify uncertainty only where authoritative source material states it. | curation overlay and coordinate review | No coordinate accuracy may be inferred from decimal digits or provider sampling. |
| P2 | Run independent expert review of mineralogy, climate conflicts and process analog rationale before any record is labeled `keep_verified`. | M1 review package | No aggregate suitability score; dimension-specific review only. |
