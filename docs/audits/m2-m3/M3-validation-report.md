# M3 validation report

> **Later M2 re-verification:** This report records the M3 milestone test count and acquisition state. The current M2 completion suite passed 75/75 and current evidence validation passed with 199 supplemental records; see [`../m2-completion/validation-report.md`](../m2-completion/validation-report.md). Historical statements below about no ingested source payloads describe the earlier gate only.

## Reproducible evidence outputs

- Evidence registry: `data/evidence/evidence-registry-v1.json`
- Coverage report: `data/evidence/evidence-coverage-v1.json`
- Validation result: `data/evidence/evidence-validation-v1.json`
- Human-readable all-site/factor matrix: `docs/audits/m2-m3/M3-evidence-coverage-matrix.csv`
- Rebuild command: `npm run build:evidence`
- Validation command: `npm run validate:evidence`

The checked-in output has 31 reference IDs × 19 factors = 589 rows. The 3 test fixtures are separately validated and do not occur in the evidence registry. The validator recognizes all four curation disposition categories; current manifest counts are 24 `keep_with_limitations`, 4 `region_only`, 3 `exclude_pending_review`, and 0 `keep_verified`.

The validation run reports **valid** with zero errors. It distinguishes state from basis, leaves unobserved values null, requires one evidence/status entry per profile factor, and checks that no record is made point eligible when M1 disallows it. The API integration test checks the evidence detail and aggregate coverage responses. Unit tests cover eligibility, empty/failed/unavailable/not-retrieved state distinction, claim traceability, null-value preservation, and fixture isolation.

Final verification: `npm test` passed **73/73**; `npm run build`, `npm run check:web`, and `npm run build:web` passed. Vite reports expected large MapLibre and React Three Fiber chunks. One run launched concurrently with the web type-check showed a transient single test failure; the serial full-suite rerun passed 73/73 and the affected unit subset passed independently. No browser end-to-end test was run.

## Historical artifacts

No historical discovery/comparison JSON files or validation reports were regenerated or edited. Latest historical comparison remains a legacy full-inventory result; new runs record the eligibility policy. The standalone validators have been updated to support both policy-declared new runs and legacy archived runs. Final validation commands were run against the existing artifacts using temporary report paths so their checked-in reports remain unchanged.

## M2 verification gate

Before M3 implementation, `npm run build` and the initial **3 M2 catalog-adapter tests** passed. The adapter suite was then expanded while completing M3; the final automated suite passes all **5 M2 adapter tests** using deterministic local fixtures for failure states, parsing, bounded downloads, coordinates, and write-once raw persistence. These tests do not claim external provider retrieval succeeded. The programmatic PAAD metadata request was blocked by the network challenge and no external source payload was ingested.
