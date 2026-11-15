# M07 — Reference-guided candidate discovery

## Status and behavior

**Bounded discovery workflow implemented and deterministic tests pass.** It generates candidate grid cells and sample centers, masks cells within configured distance of known reference point coordinates, retrieves NASA POWER, Copernicus GLO-30, and GLiM evidence through existing adapters, preserves each source result/failure, screens evidence availability against an independent mission profile, and writes validated run JSON under `data/processed/discovery-runs/`.

The application exposes the run through its bounded Node.js API. Candidate outputs are stored separately from `known-sites.json`, `reference-sites.json`, and `candidate-points.json` fixtures.

## Run and configuration

```powershell
npm.cmd run discover:candidates
npm.cmd run validate:discovery
```

Defaults use mission `extreme_environment_operations` in `data/mission-profiles/mars-surface-v1.json` and the new `data/discovery/study-areas/atacama-climate-transect-v2.json`. The legacy `atacama-bounded-test-v1.json` is retained unchanged. V2 covers 0.4° × 0.4° with 0.2° spacing (four cells), caps candidates at four, uses a 75 km point-reference exclusion, and declares/enforces a 12-call ceiling across three point providers. It is a reproducible climate-evidence workflow demonstration, not a validated discovery. The Atacama rationale and limitation are in the configuration file. The mission's six climate requirements remain unchanged; unsupported factors remain visible.

Environment configuration:

- `DISCOVERY_STUDY_AREA`: path to another versioned JSON study-area config.
- `DISCOVERY_MISSION_PROFILE`: path to a validated mission profile.
- `DISCOVERY_MISSION_ID`: mission ID from that profile.
- `DISCOVERY_MAX_CANDIDATES`: optional integer cap (1–100).
- `DISCOVERY_TIMEOUT_MS`: per-provider request timeout.
- `DISCOVERY_OUTPUT`: output JSON path (default `data/processed/discovery-runs/latest.json`).

When the default latest path is used, the CLI first archives the unique output, validates that exact run and its archive, then atomically publishes it to `latest.json` with matching per-run and latest validation reports. The application job performs the same validation before publishing.

Bounding boxes use WGS84 latitude/longitude bounds. Grid spacing is degrees; physical distance therefore varies with latitude. Partial edge cells use their clipped bounding box to compute a true in-bounds center. Candidate IDs are deterministic from study-area ID and grid-cell index. If the candidate cap is smaller than the grid, a deterministic spread of row-major cell indices is selected across the full area instead of taking only the first row. The overlap mask validates reference coordinates and conservatively expands the configured `referenceExclusionKm` by the cell's half-diagonal. Coordinate-free Semail and Lut records are explicitly listed as unmasked region references; invalid reference coordinates are separately reported. Masked points are retained as `rejected_reference_overlap` with the nearest point-reference explanation. No global search is performed.

## Evidence and screening

The pipeline calls the existing NASA POWER Daily Point client, Copernicus DEM GLO-30 COG sampler, and GLiM point query/normalizer. Successful raw source data goes to the existing `data/raw/` locations; NASA normalized daily records are separately stored in `data/processed/climate/candidates/`; compact discovery results include provenance, raw paths, product support, coverage, and source failures. Failed providers are represented explicitly, and the other providers continue.

Screening checks whether each required factor in the selected mission profile has at least one non-null observation from its mapped source. It does not evaluate thresholds or compare a candidate against Mars or reference distributions. Complete required evidence yields `evidence_supported_for_review`; missing or failed evidence yields `insufficient_evidence`; proximity masking yields `rejected_reference_overlap`. “Evidence supported for review” is not a scientific analog conclusion. No weights, scores, confidence percentage, rank, or mission suitability value is produced. Factors without existing integrations (e.g. slope/roughness, UV, mineral evidence, subsurface properties) remain missing.

## Current demonstration result (2026-11-14)

The v2 command generated four deterministic cells. One was rejected by the conservative point-reference mask; the other three were attempted. All three live providers returned `fetch failed` for each attempted cell in the current execution environment. The run remains `insufficient_evidence`; this is a genuine environment/provider failure state, not evidence of unsuitability. The exact current run identity, counts, and provider error strings are available in `data/processed/discovery-runs/latest.json` and its matching validation report. Its successful validation confirms artifact consistency, not scientific validity.

The earlier v1 one-cell archive remains as a historical run. It contains NASA POWER and GLiM successes and a Copernicus failure, so it demonstrates mixed provider outcomes with actual stored data. It is not the current demonstration configuration.

### Historical v1 demonstration result

The command `npm.cmd run discover:candidates` was run on 2026-11-14 with the checked-in test configuration and 31 known references. It generated one new candidate cell, with no overlap mask:

| Candidate | Center | Status | Provider results |
|---|---|---|---|
| `CAND-ATACAMA-BOUN-000-000-S23.5000-W69.2000` | -23.5, -69.2 | `evidence_supported_for_review` for `extreme_environment_operations` | NASA POWER succeeded; Copernicus DEM failed; GLiM succeeded |

The real NASA POWER response covers 2001-01-01 through 2020-12-31 with 7,305 valid daily observations and 100% coverage for each requested parameter. For context, its daily means include T2M 16.884 °C, RH2M 28.215%, precipitation 0.0294 mm/day, and WS10M 3.924 m/s. These are gridded NASA POWER values at an approximate grid-cell center, not field observations. GLiM returned one feature, code `vbpy__` (basic volcanic rocks; pyroclastics mentioned), which is a generalized map classification and does not imply mineral composition. Copernicus DEM extraction failed for this candidate; no elevation is reported. The mission status is `evidence_supported_for_review` only because every required extreme-environment factor has non-null NASA POWER observations; it does not mean the cell is a confirmed analog or suitable mission site.

Output: `data/processed/discovery-runs/latest.json`, archived as `data/processed/discovery-runs/63c18602-b656-4647-b305-307586ca8479.json`; validator report: `data/processed/discovery-runs/validation-report.json`. Each execution receives a unique run ID, while its stable configuration ID identifies the same study-area/profile configuration. The NASA POWER raw response and metadata are under `data/raw/nasa-power/`, normalized daily climate is under `data/processed/climate/candidates/`, and the raw GLiM query is under `data/raw/glim/`. Candidate climate persistence failure is recorded and prevents a climate factor from passing the evidence-presence screen. Automated tests use injected mocked retrieval results and are not represented as live data.

## Verification and limitations

Tests cover deterministic grid generation and distributed cap selection, clipped boundaries, invalid inputs, point-reference overlap, coordinate-free/invalid reference reporting, output separation, mission requirement presence, missing/failed/ambiguous evidence, unique run IDs, explanations, and absence of score/rank/confidence outputs. `validate:discovery` checks candidate output, study-area bounds, overlap decisions, source/status consistency, required-factor coverage, fixture/reference separation, and the unique archive.

The demonstration study area was deliberately chosen as a bounded pipeline test in the Atacama region; a distance buffer cannot establish geological independence or non-duplication at the regional scale. Point grid cells are not field sites. NASA POWER is gridded climate, Copernicus is a DSM point sample, and GLiM is generalized lithology. In the current environment's v2 execution, outbound provider requests failed; source errors are preserved. The mask explicitly reports region-level Semail/Lut as unmasked because no polygon geometry is present.

## M08 integration

M08 consumes the latest validated run and compares it against all 31 combined references. See [M08 progress](M08-evidence-comparison.md). Candidate evidence availability remains separate from every candidate/reference comparison, and neither is a ranking.
