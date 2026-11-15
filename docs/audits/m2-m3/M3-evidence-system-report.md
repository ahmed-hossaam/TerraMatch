# M3 — Unified Evidence System Report

**As of:** 2026-11-15  
**Authoritative inputs:** M1 `data/curation/reference-curation-v1.json`, `data/mission-profiles/mars-surface-v1.json`, and the 31-record `data/processed/reference-sites.json` archive.

> **M2 acquisition update:** The M2 section below records the initial implementation state and is superseded for new-source retrieval by [`../m2-completion/M2-completion-report.md`](../m2-completion/M2-completion-report.md). Current evidence adds 199 supplemental observations (195 USGS Meteor Crater report-table values and 4 regional GEOROC Etna rows); none is new point-comparison evidence.

## Implemented model

`src/evidence/unified.ts` defines one evidence vocabulary used by generation, eligibility selection, API and UI. Evidence basis and retrieval state are separate fields. Basis categories are `primary_dataset`, `peer_reviewed_source`, `official_documentation`, `atlas_claim`, `derived_value`, `unverified`, and `conflicting`. States are `available`, `not_retrieved`, `no_matching_records`, `retrieval_failed`, `unavailable`, `not_representative`, `insufficient_provenance`, and `missing`. A data record can therefore say it is an available atlas claim while separately showing no provider retrieval; an empty query is not called a failure, and a failed request is not an empty result.

`data/evidence/evidence-registry-v1.json` holds 589 factor entries (31 references × 19 profile factors), plus a separate `supplementalRecords` collection. The M2 follow-up adds 199 source-linked supplemental observations; they do not duplicate or change the 19-factor matrix. See `../m2-completion/M2-completion-report.md` for source and spatial caveats. The factor entries include compact summaries already stored in NASA POWER histories, the sampled Copernicus pixel value, and GLiM category attributes without duplicating full climate histories or feature geometry. A NASA temperature-range summary is transparently derived from valid stored daily maximum/minimum pairs and retains valid/missing counts. Missing values remain null. For provider-backed factors, it stores source identity, period, exact raw source filename and normalized artifact path, retrieval time, requested-coordinate relationship, and limitations. Legacy atlas claims remain labeled `atlas_claim`; no claim is made that the presence of a claim verifies it. Factor limitations and M1 dimension notes remain attached. `data/evidence/evidence-coverage-v1.json` and `docs/audits/m2-m3/M3-evidence-coverage-matrix.csv` enumerate state by site, dimension and factor.

## Factor interpretation

The current profile still defines five dimensions and 19 factors. No factors were renamed or removed.

| Dimension | Factors with a stored source subset | Factors without a compatible current source |
|---|---|---|
| Climate and thermal environment | Daily mean, extremes, derived daily range, humidity, precipitation, wind speed, solar radiation — NASA POWER daily gridded histories at a subset of references. | Aridity/water balance. |
| Atmosphere environment | None. | Terrestrial surface pressure, UV radiation, dust/aerosol. |
| Terrain | Point elevation — Copernicus GLO-30 DSM samples. | Slope, roughness and local relief. |
| Geology and lithology | Mapped lithology — GLiM generalized map classifications. | Site-specific mineral evidence. Geological-process descriptions remain legacy atlas claims, not newly validated evidence. |
| Surface materials and hydrology | Mapped surface class — same generalized GLiM evidence, not material assay. | Sediment/regolith properties and hydrological context. |

NASA POWER is gridded/model-derived data, not ground-station observations. A Copernicus DSM pixel is not mean elevation or a terrain survey. GLiM is generalized lithology, not mineral detection. Solar radiation is not UV. Missing values are never filled with zero. The `value:null` fields in the registry indicate this registry does not duplicate or synthesize numeric observations; the underlying linked records remain in their original project paths.

## Curation eligibility

All 31 references stay in the archive and API reference library. M1 is authoritative for dispositions and its `pointComparisonEligible` field. New discovery point masks and new comparison runs select only records marked eligible, with a `keep_verified` or `keep_with_limitations` decision and finite point coordinates. The generated workflow metadata names policy `reference-curation-v1-point-eligibility` and records excluded archive IDs. Region-only and pending-review references remain visible in archive and UI. The policy is reversible by revising the curation overlay and intentionally does not rewrite historical discovery/comparison outputs.

The current M1 manifest yields **24 eligible** references and **7 excluded from point operations**: DEV, GOB, MDV, LAN, SVA, SEM, LUT. This is an operational gate, not a judgment that the excluded sites lack scientific relevance. `scripts/run-comparison.ts` now uses only eligible point references for newly generated comparisons. `scripts/run-discovery.ts` uses eligible point references for proximity masking. Validators accept the legacy full-inventory historical artifact shape or check the explicit policy metadata for new runs.

## API and interface

- Existing reference list/detail contracts remain intact and additive.
- `GET /api/references/{id}/evidence` returns the factor-level records and eligibility state, without exposing raw provider payloads.
- `GET /api/evidence/coverage` returns the reproducible coverage artifact.
- Reference detail renders factor, basis, state, source/path, and limitations in expandable rows. It labels atlas claims as unverified and warns when the reference is not point-comparison eligible.
- No rankings, scientific confidence percentages, analog confirmation, or combined quality score are created.
- The UI was type-checked and production-built, and API endpoints were exercised through integration tests; no browser end-to-end run was performed in this milestone.

## Validation state

`npm run validate:evidence` checks all 31 IDs, the 3 separate fixtures, 19 factors per reference, unique factor rows, valid basis/state vocabulary, raw and normalized primary-dataset provenance, no non-null values for unavailable states, curation eligibility consistency, and 589 coverage rows. It also verifies supplemental records against the normalized M2 acquisition. The current report is `data/evidence/evidence-validation-v1.json`. Current state counts among the 589 factor rows are 80 `available`, 230 `not_retrieved`, 278 `unavailable`, and 1 `not_representative`; the other states are zero. `available` means a relevant stored provider artifact exists; the row’s basis and limitations still determine what it can support. Legacy claim presence is reported separately in `legacyClaimState`. Availability does not mean scientific verification.

## Limitations

The initial M2 attempt added no source observations; a targeted follow-up acquired supplemental report/compilation observations as described above. They lack suitable point-level coordinates and therefore do not expand point-comparison evidence. Existing provider storage covers only a subset of references; several current normalized integrations retain gridded, pixel, or generalized data rather than field-site observations. M1 curation decisions remain preliminary. No independent geoscientist has reviewed all 31 sites, coordinates, or citations. Historical comparison runs were preserved as generated under their original complete-inventory policy and are not retroactively filtered.
