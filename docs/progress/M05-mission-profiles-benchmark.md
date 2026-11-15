# M05 — Mission profiles and blind benchmark planning

## Status

**Requirements and protocol artifacts implemented and validated.** This is not a scientific validation of the mission factors, a benchmark execution, or a similarity engine. The authoritative set has 31 references (26 atlas + 5 reviewed additions), but these heterogeneous positive examples do not support a defensible calibration/holdout split. There are no independent negative/control labels; provider retrievals cover five original atlas sites and three supplementary point-area records. Both split lists remain empty.

## Implemented files

- `src/types/mission-profile.ts` defines versioned profile and benchmark types.
- `src/schemas/mission-profile.ts` validates versions, evidence availability/provenance, units and factor metadata, mission factor references, split integrity, feature leakage, and disallows score/rank/weight outputs in requirements artifacts.
- `data/mission-profiles/mars-surface-v1.json` defines five dimensions, 19 factors, and four mission profiles.
- `data/benchmarks/blind-benchmark-protocol-v1.json` defines reference/candidate/fixture roles, why no split was created, leakage controls, outcome language, and future evaluation evidence.
- `scripts/validate-mission-profiles.ts` validates the M05 artifacts against location data and M02–M04 reports, then writes `data/processed/mission-profiles/validation-report.json`.
- `tests/mission-profile.test.ts` covers schema/version/units/provenance, null and availability handling, split leakage, record type separation, and score/ranking exclusion.
- `docs/data-sources/copernicus-dem.md` and `docs/progress/M03-copernicus-dem.md` have a focused correction to describe the existing Node.js `geotiff` implementation without stale GDAL range support references.
- `README.md` now reports M05 requirements/protocol status and the actual M05 validation command.

## Profile dimensions and current evidence

1. **Climate and thermal environment:** NASA POWER daily T2M, T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, WS10M, and ALLSKY_SFC_SW_DWN are available for GKC, GKB, WDE, KHA, RTI, DALL, DAL, and AHS-GH from 2001–2020. Daily temperature range is derived only where both extrema exist. Only complete calendar years are labeled complete precipitation totals. Gridded values at approximate or area coordinates are not site observations. Solar radiation is explicitly not UV. Aridity/water balance is unavailable.
2. **Atmospheric/environmental context:** terrestrial surface pressure was not retrieved; direct UV and dust/aerosol evidence are unavailable. No NASA POWER variables are assumed beyond the existing seven.
3. **Terrain:** Copernicus DEM GLO-30 point DSM elevation is present for the five original sites and three supplementary point-area sites. A single sample is not slope, roughness, local relief, obstacles, or terrain diversity; DSM is not guaranteed bare earth.
4. **Geological/lithological context:** GLiM mapped categories are available for five original points and three supplementary point-area records, retaining source levels. GLiM is generalized mapping (about 1:3.75 million), not field truth or mineral detection. Mineral evidence is unavailable; legacy atlas descriptions remain unverified context.
5. **Surface materials, sediments, and hydrology:** generalized mapped lithology is available for eight point-area records. Quantitative grain size, sand/rock fractions, regolith depth, geotechnical properties, and direct water/ice/groundwater evidence are unavailable.

Each factor records rationale, definition, unit/category description, requirement status, evidence kind, source and provenance, available site IDs, spatial/temporal support, limitations, and the next evidence need. Missing values are not represented as zero. Evidence availability is distinct from confidence; no confidence calculation is made.

Four mission profiles are represented independently: rover surface testing, geological surface exploration, extreme environment operations, and drilling/subsurface. Drilling explicitly requires subsurface/material evidence; surface climate or elevation alone cannot satisfy it. The current evidence-state labels are requirements planning indicators, not scientific scores.

## Blind benchmark protocol

The protocol identifies the 31-record combined set as positive known references, the latest single bounded candidate region, and the three software test fixtures. The original 26-site benchmark manifest and supplementary-site review are both linked. Fixtures are excluded from any benchmark role. The `benchmark-sites.json` manifest remains in the repository, so it is not a secure blind-label store; no blind run is permitted based on this plan alone.

`candidateRegionCount` records the count at protocol planning time; it is not a live count tied to each generated M07 run. Current generated candidates remain inputs to leakage checks only and are not benchmark labels.

Future results must show source evidence, units, measured/derived status, spatial and temporal support, coverage, missing factors, uncertainty, limitations, and adjudication. Missing evidence is “unknown/insufficient,” never a negative match. Valid/partial/unsupported terms require pre-registration and expert review. Spatial matching buffers, sample-size targets, and performance metrics are intentionally not fabricated. Independent positive and negative/control references, coordinate uncertainty, mission-specific reviewed labels, broader representation, a pre-registered grouping and sample-size plan, and a separate label store are needed before a split can be designed.

## Commands and verification

```powershell
npm.cmd test
npm.cmd run validate:data
npm.cmd run validate:copernicus-dem
npm.cmd run validate:glim
npm.cmd run validate:mission-profiles
```

Results for this implementation:

- Automated test suite at final consolidation: **52 passed, 0 failed**.
- M01 data validation: **26 known-site records and 3 test fixtures valid**.
- Copernicus DEM validation: **5/5 sites valid**, no missing values or failures.
- GLiM validation: **5/5 sites mapped**, no ambiguous, missing, or failed results.
- M05 validation after consolidation: **valid**; 5 dimensions, 19 factors, 4 missions, 31 references, 1 bounded candidate, and 3 fixtures; benchmark split not created and execution not run.
- The three source availability site-ID lists in the profile were cross-checked against the generated M02–M04 validation reports.

Validation confirms structural consistency, not scientific validity of the factor choices, labels, source suitability, or future benchmark performance. No source retrieval was needed for M05.

## Limitations and next step

- The atlas is a small positive-only reference collection; do not split it and report generalizable benchmark performance.
- There are no generated candidate regions and no blind candidate ranking input pipeline yet.
- Eight-site climate/terrain/lithology retrieval coverage is selective; 23 references have no corresponding retrieved provider records, and sampled coordinates are approximate or represent site areas.
- Mission factors still require domain expert review and better evidence for aridity, UV, dust, material properties, hydrology, terrain derivatives, and subsurface conditions.
- No similarity scores, mission scores, weights, rankings, or benchmark metrics were generated.

Next: assemble an independent, expert-reviewed reference and control dataset with coordinate uncertainty and mission-specific labels; establish an external label custodian and pre-register spatial grouping before any blind benchmark. Only after scientific review of factors and evidence comparability should a future milestone design a scoring method.
