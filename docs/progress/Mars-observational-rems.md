# Mars observational evidence — Curiosity REMS temperature

## Status and scope

This milestone adds a reproducible, deliberately sampled Mars observational reference: reduced MODRDR air-temperature data from NASA's Mars Science Laboratory / Curiosity REMS instrument at Gale Crater. It is a separate Mars evidence context, not a new Earth reference site and not a change to TerraMatch's comparison math, M1 curation, 31-site archive, or mission-factor definitions.

The derived artifact is [`data/processed/mars/rems-air-temperature-v1.json`](../../data/processed/mars/rems-air-temperature-v1.json), schema 1.0.0, extraction version `terramatch-rems-modrdr-1.0.0` (about 73 KB). It contains no raw source rows. The source acquisition script is [`scripts/acquire-mars-rems.mjs`](../../scripts/acquire-mars-rems.mjs); parser, aggregation, source checks, and validation live in [`src/mars/rems.ts`](../../src/mars/rems.ts). Raw tables and XML labels are retained only in the OS temporary cache, outside Git. Re-run with `npm run acquire:mars-rems`; validate with `npm run validate:mars-rems`.

## Exact PDS product and actual coverage

- NASA PDS dataset: `MSL-M-REMS-5-MODRDR-V1.0`, dataset version V1.0; PDS Atmospheres volume `mslrem_1001`, using the PDS Atmospheres Node data-volume MODRDR ASCII tables and matching PDS4 XML product labels (label version 1.0). The dataset is the REMS team's highest processed record level and includes physical units with corrections and modeling.
- Official entry points: [PDS dataset profile](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MSL-M-REMS-5-MODRDR-V1.0), [PDS volume](https://atmos.nmsu.edu/PDS/data/mslrem_1001/), [REMS temperature documentation](https://atmos.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems_temperature.html), [REMS RDR SIS](https://cab.inta-csic.es/rems/wp-content/uploads/2013/04/REMS_RDR_SIS.pdf).
- The acquisition is a central-mission-year seasonal sample: 12 target sols, one per nominal 30-degree Ls bin. Ten products were available; target sol directories **2179** and **2328** were not listed in their PDS parent range directories (not an HTTP failure, and not treated as successful retrievals). The ten actual source sols are **1718, 1781, 1847, 1913, 1975, 2032, 2084, 2132, 2226, 2275**. Actual label-derived Ls, each PDS UTC start/stop interval, and per-sol sample counts are stored in the artifact. The accepted sample spans Ls bins 000–240 and 270–330 degrees; 240–270 and 330–360 have no retrieved products in this sample. No missing bin is filled.
- The ten products contain **335,521 source rows**. **249,657** passed the documented filter; **85,864** were rejected (the artifact gives rejection reasons and per-sol confidence-code counts). Ten of twelve planned sols were retrieved. These counts are rows/samples, not distinct sites; all rows are from one rover location in one sampled mission year.
- REMS table timestamps are seconds since noon 1 January 2000; LMST encodes the sol. Ls is not supplied in these selected table columns, so TerraMatch derives one Ls per sol from the midpoint of the PDS4 product's UTC `start_date_time` / `stop_date_time` interval using the [NASA GISS Mars24 algorithm](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html), with published UTC-to-TT offsets and perturbation terms. That per-sol Ls is assigned to the product's rows; REMS counter timestamps are not independently converted to UTC. The acquisition checks the filename sol against LMST sol.

## Measurement and quality rules

The normalized parameter is `AMBIENT_TEMP` in kelvin. PDS describes it as an estimated ambient air temperature: local boom air temperatures are estimated from sensor temperatures, then an ambient estimate is calculated by filtering the two local values. It is a rover-mounted, processed/model-corrected ambient-air estimate, not ground temperature. The selected RMD table rows are session samples, with a maximum 1 Hz product resolution and irregular within-sol operational coverage; nominal operation is commonly five minutes per hour, with additional sessions.

The corresponding `AMBIENT_TEMP_CONFIDENCE_LEVEL` field is preserved as a nine-character code in aggregate counts. The actual PDS4 field description specifies byte 0 at the left, byte 7 as the operational-range test (error below 5 K), and byte 8 as observation reliability. TerraMatch accepts a finite non-sentinel temperature only when the code has nine `[01X]` characters, byte 7 is `1`, and byte 8 is `1`. This is a transparent project filter based on the two directly relevant label-defined checks; it is not a PDS universal threshold. `X` values in ancillary contextual flags are counted and retained but do not automatically reject the ambient-temperature row. Missing/sentinel temperatures, unknown/malformed relevant flags, and non-optimal relevant flags are separately counted. Rejected records are never zero-filled or interpreted as evidence of absence.

For each sampled sol the artifact contains accepted-sample count, rejected count by reason, confidence code counts, sample mean, observed accepted-sample minimum/maximum, and their range. Those extrema are sampled session extrema, not guaranteed full-sol extrema. Ls-bin q25/median/q75 summarize accepted rows from the one selected sol in each available bin; these summarize within-sol samples and do **not** estimate between-sol or multi-year variability. Per-sol range quantiles are likewise limited to the sampled rows.

## Earth context and claim boundaries

Eight stored NASA POWER histories are displayed alongside REMS: GKC, GKB, WDE, KHA, RTI, DALL, DAL, and AHS-GH. Each stored history spans **2001-01-01 through 2020-12-31**, with **7,305 daily T2M rows, 7,305 valid and zero missing**. POWER T2M is a gridded/model-derived daily 2 m product, not a ground-station observation. REMS is an in-situ rover-mast ambient estimate with different measurement height, processing, and cadence. The records are not date-aligned; no Earth/Mars temperature difference is computed. Their status is `ambiguous` descriptive juxtaposition, not a compatible factor comparison.

Humidity is not compared because its measurement definitions and retrieval are outside this task. Pressure may be part of the wider REMS product but no pressure matchup is produced here; no matching Earth pressure observations were retrieved in this integration. Ground-temperature data are not substituted for air temperature. No Mars measurements for other evidence dimensions are inferred from temperature.

All four mission profiles are carried into an Evidence Gap / Claim Boundary view using their existing 19 factors. Required-factor states are derived deterministically: thermal factors have a separate but incompatible REMS observation and remain `ambiguous`; factors outside the integrated product are `unavailable`. Each record states Earth source type, Mars measurement type, limitation, and next evidence needed. This does not create a readiness score, suitability verdict, ranking, or confirmed Earth analog.

## Reproduction and validation

```powershell
npm run acquire:mars-rems
npm run validate:mars-rems
```

The acquisition retrieves only the selected per-sol MODRDR tables and matching labels; it does not request the full volume. SHA-256 is recorded for each table and label. The validator checks artifact schema/version, row-count balance, 12 Ls bins, source URLs/checksums, eight named Earth histories and periods, 31 references, three separate fixtures, five dimensions, 19 factors, 589 evidence registry rows, and four mission profiles. API access is read-only at `/api/mars-evidence/rems`. The Vercel seed manifest lists the compact derived artifact so a separately authorized future artifact migration can carry it; this task does not deploy or migrate production data.

### Primary source references

- NASA PDS Atmospheres Node, *MSL MARS ROVER ENV MONITORING STATION 5 MODRDR V1.0*, dataset profile (`MSL-M-REMS-5-MODRDR-V1.0`), release date 2019-12-05, PDS catalog updated 2019-12-04: [dataset profile](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MSL-M-REMS-5-MODRDR-V1.0).
- REMS RDR SIS, CAB-REMS-SPC-0006 / JPL-D38125, Issue 1 (2013): [SIS PDF](https://cab.inta-csic.es/rems/wp-content/uploads/2013/04/REMS_RDR_SIS.pdf).
- NASA GISS Mars24, solar longitude algorithm: [algorithm documentation](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html).
