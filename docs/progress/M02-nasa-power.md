# M02 — NASA POWER daily climate integration

## Status

**Complete for the five-site prototype sample.** Five real NASA POWER responses are present, validated, and linked to the correct known-site IDs. They cover 2001-01-01 through 2020-12-31, with 100% daily coverage for each of the seven requested parameters. The final combined output was rebuilt from the already stored raw responses; this rebuild made no network requests and did not rewrite raw responses.

The successful responses were retrieved on 2026-11-14. Site coordinates are atlas coordinates and are marked approximate; NASA POWER point values are gridded estimates and are not exact field measurements.

## Official API and variables

The adapter uses NASA POWER's Daily Point JSON endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`, `format=JSON`, and `time-standard=UTC`. The configured period is 2001-01-01 through 2020-12-31. All five saved responses report this full actual period, NASA POWER API version 2.10.3, and sources MERRA2, SYN1DEG, and POWER.

| ID | Definition | Unit in response |
|---|---|---|
| `T2M` | Daily mean air temperature at 2 m | °C |
| `T2M_MAX` | Daily maximum air temperature at 2 m | °C |
| `T2M_MIN` | Daily minimum air temperature at 2 m | °C |
| `RH2M` | Relative humidity at 2 m | % |
| `PRECTOTCORR` | Corrected precipitation | mm/day |
| `WS10M` | Wind speed at 10 m | m/s |
| `ALLSKY_SFC_SW_DWN` | All-sky surface shortwave downward radiation | MJ/m²/day |

These identifiers and units were verified against NASA's official [daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/), [API overview](https://power.larc.nasa.gov/docs/services/api/), [meteorological source notes](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/), and [parameter catalog](https://power.larc.nasa.gov/parameters/). Solar radiation is not UV, and no UV measurement is inferred.

## Retrieval result

| Site | Requested latitude, longitude | Response elevation | Actual period | Coverage for every parameter |
|---|---|---:|---|---:|
| GKC | 22.8, 26.2 | 799.05 m | 2001-01-01–2020-12-31 | 100% |
| GKB | 23.5, 26.0 | 889.82 m | 2001-01-01–2020-12-31 | 100% |
| WDE | 22.0, 28.5 | 289.77 m | 2001-01-01–2020-12-31 | 100% |
| KHA | 25.45, 30.55 | 192.03 m | 2001-01-01–2020-12-31 | 100% |
| RTI | 37.69, -6.56 | 187.78 m | 2001-01-01–2020-12-31 | 100% |

All five atlas locations have `coordinatesApproximate: true`. NASA response `geometry.coordinates` is parsed in GeoJSON order `[longitude, latitude, elevation]`; requested coordinates remain separately represented as latitude/longitude. Geometry is optional and missing geometry does not invalidate otherwise valid climate observations.

## Architecture and files

- `src/data-sources/nasa-power/` handles request construction, fetching, response parsing, caching, and raw preservation.
- `scripts/retrieve-nasa-power.ts` fetches configured known sites; `scripts/rebuild-nasa-power.ts` validates and normalizes existing raw responses without network access.
- `data/raw/nasa-power/` holds immutable response bodies and metadata sidecars.
- `data/cache/nasa-power/` stores request-keyed reusable responses.
- `data/processed/climate/known-sites-daily.json` holds linked daily normalized values, summaries, coverage, requested coordinates, and provider response coordinates/elevation.
- `data/processed/climate/retrieval-report.json` records the verified site list, periods, parameter coverages, and retrieval metadata.
- `tests/nasa-power.test.ts` covers request building, validation, missing data, normalization, cache behavior, provenance, and geometry handling.

Missing sentinels become `null` while their raw values remain in raw JSON. Missing and invalid observations are explicitly statused. Daily range requires both daily extrema. Annual precipitation is only labeled a complete total for complete calendar years with all daily values present; incomplete annual observed sums remain distinct. Similarity and scientific confidence scores are not calculated.

## Reproduction commands

```sh
npm.cmd test
npm.cmd run validate:data
npm.cmd run rebuild:nasa-power
npm.cmd run retrieve:nasa-power
```

`rebuild:nasa-power` uses existing raw responses and performs no external request. `retrieve:nasa-power` defaults to the five IDs above, baseline dates, and the seven parameters; its `NASA_POWER_SITE_IDS`, `NASA_POWER_START`, `NASA_POWER_END`, and `NASA_POWER_PARAMETERS` environment variables allow a smaller/configured request.

## Verification and limitations

- Existing raw responses checked: **5/5 valid** (GKC, GKB, WDE, KHA, RTI); failures: **0**.
- Requested and actual period: **2001-01-01–2020-12-31** for all five.
- Coverage: **100% for all seven parameters at each site**.
- Final normalized data regenerated from those raw files; raw response files were not rewritten.
- Deterministic tests include response-coordinate order, elevation preservation, missing geometry, and UTF-8 unit serialization.
- Climate records represent gridded NASA POWER data, not ground-truth observations. Approximate atlas coordinates and dataset resolution constrain site-level interpretation.
- This is a five-site retrieval only; it does not establish global coverage, validate Mars analog status, or rank sites. `ALLSKY_SFC_SW_DWN` is not UV.

Next milestone: Copernicus DEM elevation ingestion (M03); GLiM remains M04.
