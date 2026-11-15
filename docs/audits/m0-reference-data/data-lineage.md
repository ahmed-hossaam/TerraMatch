# M0 Data lineage and runtime consumers

## Lineage diagram

```mermaid
flowchart TD
  A[Arabic structured source atlas] --> B[scripts/audit-atlas.ts]
  B --> C[data/processed/atlas-audit.json]
  A --> D[src/normalization/atlas.ts]
  D --> E[data/processed/known-sites.json<br/>26 normalized records]
  F[Mars_Analogues_Haneen_Ayman.json<br/>research context + references] -. contextual only; not normalized as records .-> D
  G[data/benchmarks/supplementary-site-review.json<br/>curation decisions + citations] --> H[data/processed/supplementary-known-sites.json<br/>5 separately normalized records]
  H --> I[scripts/retrieve-supplementary-evidence.ts]
  J[data/raw/* provider responses] --> K[src/data-sources/* parsers/normalizers]
  K --> L[data/processed/{climate,terrain,geology,supplementary-evidence}]
  E --> M[scripts/build-reference-dataset.ts]
  H --> M
  M --> N[data/processed/reference-sites.json<br/>26 + 5 = 31]
  N --> O[API /api/references, /api/summary]
  N --> P[src/discovery/grid.ts reference overlap masking]
  N --> Q[scripts/run-comparison.ts references input]
  L --> Q
  R[data/discovery/study-areas/* + data/mission-profiles/*] --> S[scripts/run-discovery.ts]
  P --> S
  S --> T[data/processed/discovery-runs/* + validation reports]
  T --> Q
  Q --> U[data/processed/comparison-runs/* + validation report]
  T --> O
  U --> O
  V[data/processed/candidate-points.json<br/>3 test_fixture rows] -. validation exclusion only .-> T
  V -. validation exclusion only .-> U
  O --> W[React map, library, discovery, compare, report]
```

## Source and normalization roles

- **Original atlas:** `أطلس المواقع المشابهة للمريخ (JSON).json`. `scripts/audit-atlas.ts` and `src/normalization/atlas.ts` inspect and normalize its 26 records. The normalization preserves legacy claims, marks atlas-derived values as `legacy_value`, and attaches warnings; it is not independent scientific verification.
- **Research context:** `Mars_Analogues_Haneen_Ayman.json` is an Arabic research-style document with sections and references. It is contextual source material, not the schema source for 26 structured measurement records. M06 notes it does not provide the five supplements or their site-specific citations.
- **Supplement review:** `data/benchmarks/supplementary-site-review.json` records the separate review rationale, site granularity, citation links, and explicit no-inference policy. `scripts/build-reference-dataset.ts` normalizes `data/processed/supplementary-known-sites.json` and combines it with the 26 legacy records.
- **Authoritative combined record for current runtime:** `data/processed/reference-sites.json`. This file feeds the API, discovery reference overlap masking, and comparison. It is built, not the original source.
- **Fixtures:** `data/processed/candidate-points.json` contains three `test_fixture` records. Validators use it to reject fixture leakage; it is not a reference source and not candidate discovery output.
- **Provider chain:** `data/raw/{nasa-power,copernicus-dem,glim}` hold raw responses and metadata. Clients and normalizers under `src/data-sources/` create processed evidence. NASA daily climate summary data is in `data/processed/climate/known-sites-daily.json`; Copernicus samples in `data/processed/terrain/elevation-samples.json`; GLiM outputs in `data/processed/geology/known-sites-glim.json`. Supplement point records and daily histories are in `data/processed/supplementary-evidence/`.
- **Discovery:** `data/discovery/study-areas/*.json`, `data/mission-profiles/mars-surface-v1.json`, combined references, and provider clients feed `src/discovery/run.ts` / `scripts/run-discovery.ts`. The grid is masked against point references using a conservative cell footprint rule; region-only references stay unmasked.
- **Comparison:** `scripts/run-comparison.ts` loads the chosen discovery artifact, the combined reference dataset and stored real histories/evidence; `src/comparison/compare.ts` produces dimension-level comparisons. The generated run names its discoveryRun ID and reference IDs. It does not produce an overall similarity score.

## Application data consumers

`scripts/app-api.mjs` is the HTTP API’s file reader. It reads the current combined reference artifact, fixtures, profile, current discovery/comparison heads, validation reports and run archives. It enumerates archives for run history, returns reference/profile/study-area endpoints, retrieves candidate evidence and exposes comparison/discovery artifacts. The frontend API client consumes these endpoints; map/library/comparison/report views therefore depend on API projections of those same artifacts. The report builder applies selected candidate/reference filters to comparison data.

## Consistency findings

- `known-sites.json` has 26 IDs; `supplementary-known-sites.json` has five IDs; combined `reference-sites.json` has 31 unique IDs. Five supplementary records appear both in the supplement source file and combined output by intentional combination, not duplicate IDs within the combined inventory.
- The five extra records are DALL, DAL, SEM, AHS-GH and LUT. SEM and LUT have null coordinates; the review says not to substitute a point for those regions.
- Three fixtures are kept in a distinct file/type. The current validation report explicitly records that separation.
- The audit report’s `missingFormalLithologyClassification` list and count need interpretation with care: GIS GLiM evidence exists for eight point-sampled sites, but this does not backfill or verify each legacy record’s atlas lithology. The two layers of evidence should remain separate.
- Existing reports are snapshots. The reference validation report’s timestamp is 2026-11-14T22:35:40.876Z; provider reports have earlier 2026-11-14 timestamps. The audit compared their declared paths/statuses with the files on disk; it did not rewrite them. Any future M1 rebuild must regenerate downstream reports/artifacts in dependency order and validate the exact IDs/source hashes.
- `data/processed/mission-profiles/validation-report.24292.tmp` and an orphan temporary file are present. These are not reference records, but indicate prior interrupted write artifacts and should be handled only by a separately approved cleanup procedure after provenance checks.

## Files that should remain distinct

Do not conflate the atlas source, research context, normalized legacy set, supplement review, raw provider response, processed evidence, generated discovery/comparison artifacts, or test fixtures. Preserve each source path and version/hash in any future curation record.
