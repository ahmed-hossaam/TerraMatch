# Phase 10 — LOLA LDEM_4 Geospatial Verification & Scientific Validation

## Outcome

`RESULT: LOLA_GEOSPATIAL_BLOCKED`

The official documentation resolves the product's coordinate conventions and pixel-center mapping. The processed array itself is intact and its basic quality patterns were inspected. An independent point-level cross-check against LOLA RDR observations was not completed, so this work does **not** advance scientific validation, create a GeoTIFF, or mark the layer map-ready.

## Starting state and preservation

- Branch: `backend-preview-integration`
- Starting and ending commit: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`
- The working tree already contained unrelated changes before this task. They were preserved.
- The source cache and processed NPY were read only. No scientific source, Mars/Earth data, production resource, database, environment setting, or Git history was changed.
- The only files changed for this phase are this report and the report index. No application code or lifecycle state was changed.

## Source integrity and processed array

The external cache files were rehashed during this phase:

| Source | Size | SHA-256 | Result |
|---|---:|---|---|
| `ldem_4.jp2` | 1,436,447 bytes | `9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3` | Exact expected digest and size matched |
| `ldem_4_jp2.lbl` | 6,602 bytes | `102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8` | Exact expected digest and size matched |

The existing `data/processed/moon/lola/ldem_4_height_m.npy` was loaded read-only. Its SHA-256 remains `6D750B3134F9F8272913E70793F3140DC6CE2FD857865BD9F28DD7885123D417`; it is a `(720, 1440)` `float32` array. It contains 1,036,800 finite values and zero NaNs. The companion AUX NoData value is `-32768`; therefore zero samples match that NoData rule. This is only a count under that sentinel rule—not evidence of complete geographic or observed-data coverage, and no other quality mask was applied.

The processed variable remains relative height: raw DN × 0.5 m. The 1,737,400 m reference radius is not added. The official GDR product documentation explicitly distinguishes `HEIGHT = DN × SCALING_FACTOR` from `PLANETARY_RADIUS = DN × SCALING_FACTOR + OFFSET` ([PDS Geosciences LOLA GDRDEM description, conversion notes](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20(LRO)/LOLA/GDR/GDRDEM.htm)). This supports the existing processed-array interpretation; it does not independently validate its spatial values.

## Official spatial documentation reviewed

1. **Product label:** the local detached PDS3 label for `LDEM_4`, dataset `LRO-L-LOLA-4-GDR-V1.0`, version `V3.0`. It declares `SIMPLE CYLINDRICAL`, 4 pixels/degree, center latitude/longitude 0°, line/sample projection offsets 359.5/719.5 pixels, positive-east longitude, −180°..+180° longitude bounds, −90°..+90° latitude bounds, `MEAN EARTH/POLAR AXIS OF DE421`, 1,737.4 km spherical axes, and “pixel registered.”
2. **LOLA dataset map-projection catalog:** [official `dsmap.cat`](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/catalog/dsmap.cat), `DATA_SET_MAP_PROJECTION_INFO`, for dataset `LRO-L-LOLA-4-GDR-V1.0`. It specifies forward and inverse line/sample equations, positive array direction right and down, upper-left pixel `(line 1, sample 1)`, and that integer line/sample positions are pixel centers (catalog text, lines 35–105).
3. **Archive volume SIS:** [official LOLA Archive Volume SIS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/archsis.htm), §3.1.5, “Science Data File Formats.” It states global JP2 files use projection center longitude 0° following GIS practice, unlike the 0–360° convention for IMG products; GDR pixels represent mean values at region centers, scaled/interpolated where needed; and the global standard projection is simple cylindrical (document lines 551–555).
4. **LOLA RDR and derived-products SIS:** [official PDS Geosciences RDR SIS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/rdrsis.htm), §2.4.3, “Coordinate Systems.” It describes LRO data as lunar planetocentric/body-fixed, Mean-Earth/polar-axis, east-positive coordinates. That section describes RDR coordinates in 0–360°; the product-specific global JP2 label and Archive SIS specify the −180°..+180° display convention used here.
5. **Independent point-data access documentation:** [Lunar ODE LOLA RDR Query Tool v2.0](https://oderest.rsl.wustl.edu/GDSWeb/GDSLOLARDR.html), which searches individual RDR points, and [ODE tools listing](https://ode.rsl.wustl.edu/moon/tools.aspx). The tool documentation says queries execute in the background and results are emailed.

### Coordinate equations derived from the authoritative catalog and this label

For zero-based array row `r` and column `c`, convert to the PDS one-based indices as `LINE = r + 1` and `SAMPLE = c + 1`. Substituting the label values into the catalog's inverse pixel-center equations gives:

```text
longitude_deg = 0 + (SAMPLE - 719.5 - 1) / 4
              = (c - 719.5) / 4

latitude_deg  = 0 - (LINE - 359.5 - 1) / 4
              = (359.5 - r) / 4
```

Consequently, the catalog-documented pixel centers at the corners are: row 0 / column 0 = (+89.875°, −179.875°); row 0 / column 1439 = (+89.875°, +179.875°); row 719 / column 0 = (−89.875°, −179.875°); row 719 / column 1439 = (−89.875°, +179.875°). Rows increase southward; columns increase eastward. The center coordinate (0°, 0°) lies between the four central pixel centers because both dimensions are even. The nominal outer cell edges coincide with the label's −90°..+90° and −180°..+180° grid bounds.

These are documentation-derived coordinate mappings, not an empirical landmark check. The global JP2 longitude domain is product-specific; the generic map catalog's non-negative-longitude description and the RDR 0–360° convention must not be applied to this JP2 without conversion. The sources do not justify treating the lunar body-fixed coordinates as an Earth EPSG CRS. A planet-specific georeferenced output would need explicit custom Moon CRS/frame metadata and independent validation; no such output was created.

## Independent spatial cross-check

**Not completed.** No independent RDR shot rows or suitable independently documented coordinate/elevation controls were available in the repository or the inspected local artifacts. The official ODE interface is an appropriate next source for point-level cross-checks, but its v2 queries run asynchronously and return results by email. No ODE query was submitted and no external observations were retrieved in this phase.

This matters because the GDR is binned/interpolated data derived from LOLA observations. Agreement with another view or rendering of the same grid would not be an independent check. A defensible next check should obtain a small RDR point set in the same ME/DE421 frame and compatible processing period, map those points to LDEM_4 cells using the equations above, and compare multiple quality-accepted shots with each cell's gridded/interpolated value. Tolerance should be based on shot quality, within-cell terrain spread, and GDR processing—not an invented universal threshold.

## Read-only data-quality screening

Statistics below were computed directly from the existing NPY with NumPy; they are descriptive screens, not product validation. Values are relative height in meters. Row/column summary quantiles report the distribution across row or column minima, maxima, means, and population standard deviations.

| Summary across rows (720) | Min | 25th percentile | Median | 75th percentile | Max |
|---|---:|---:|---:|---:|---:|
| Per-row minimum | −8,879 | −5,872.5 | −4,450.5 | −3,781.125 | −635.5 |
| Per-row maximum | −165.5 | 4,180.5 | 5,159.75 | 7,004.75 | 10,504 |
| Per-row mean | −1,992.535 | −1,104.191 | −687.186 | −28.316 | 1,033.121 |
| Per-row standard deviation | 167.678 | 1,837.572 | 2,124.637 | 2,417.627 | 2,718.572 |

| Summary across columns (1,440) | Min | 25th percentile | Median | 75th percentile | Max |
|---|---:|---:|---:|---:|---:|
| Per-column minimum | −8,879 | −5,450 | −4,665.75 | −3,943 | −2,763 |
| Per-column maximum | 1,640 | 3,700.625 | 4,693.5 | 6,074.875 | 10,504 |
| Per-column mean | −1,571.340 | −1,064.215 | −687.217 | −25.575 | 1,044.965 |
| Per-column standard deviation | 820.691 | 1,275.826 | 1,552.349 | 2,356.377 | 4,244.639 |

| Whole-array check | Result |
|---|---:|
| Minimum / maximum | −8,879 m / 10,504 m |
| Mean / population standard deviation | −519.76685 m / 2,203.09253 m |
| NoData sentinel matches | 0 of 1,036,800 |
| Minimum location (zero-based row, column) | (641, 30) |
| Maximum location (zero-based row, column) | (338, 85) |

Absolute adjacent-sample difference quantiles were: horizontal p50 101 m, p95 895.5 m, p99 1,530.5 m, p99.9 2,316.46 m, max 4,190.5 m; vertical p50 182 m, p95 1,258 m, p99 1,927 m, p99.9 2,715.641 m, max 4,218 m. These large differences cannot be labeled artifacts from magnitude alone at this approximately 7.58 km nominal pixel scale; steep terrain and interpolation contribute, and this audit did not classify individual pixels.

The longitude seam (first versus last column, a half-pixel center separation across the wrap) had absolute-difference p50 162.5 m, p95 1,062.1 m, p99 1,916.615 m, max 2,562 m. This screening statistic alone neither proves nor disproves a seam artifact.

Nominal 45° latitude-band transitions fall at row boundaries 179/180, 359/360, and 539/540 under the documented row mapping. Their absolute adjacent row-mean differences were 42.338 m, 23.721 m, and 41.750 m; across all adjacent row means the median was 28.440 m, p95 116.621 m, p99 235.350 m, and maximum 569.277 m. These coarse row-mean checks show no exceptional discontinuity at the three nominal boundaries, but cannot establish that the label-noted band-edge artifacts are absent. The label's interpolation warning and coverage caveat remain applicable.

## Artifact and lifecycle decision

- No GeoTIFF, geotransform, map tile, or other map-delivery artifact was created.
- The existing NPY and JSON sidecar were not regenerated or edited. The sidecar therefore conservatively continues to state that its array is not georeferenced and records the earlier unresolved coordinate notes; the official documentation findings above are new audit evidence, not a silent rewrite of that artifact.
- The registry lifecycle remains: one LOLA product acquired, inspected, decoded, and processed; validation `blocked`; map delivery `not_started`.
- The Moon registry validator reports 13 registered families, 1 acquired, 1 processed, 0 validated, and 0 map-ready. Renderable real-data layers remain 0.
- No other Moon product was advanced.

## Verification

| Command/check | Result |
|---|---|
| Read-only source size/SHA-256 verification | Both source files matched exact expected sizes and hashes |
| Read-only processed NPY SHA-256, dimensions, dtype, finite/NaN counts | Matched existing sidecar and expected `(720, 1440)` Float32 array; no NaNs |
| `npm test` | **148 passed, 0 failed** (includes TypeScript build) |
| `npm run moon:registry:validate` | Passed; 13 entries, 1 acquired, 1 processed, 0 validated, 0 map-ready, 0 registry errors |
| Independent point-level spatial cross-check | Not performed; no reference observations obtained |
| GeoTIFF / map readiness | Not produced; not claimed |
| Browser QA / web build | Not run; outside this verification task and no frontend changes were made |

## Exact blocker and next step

The remaining blocker is an actual independent reference comparison—not the coordinate equations. Obtain a small, version-compatible set of quality-accepted LOLA RDR shot records and labels from the official ODE/PDS query service (or another independently documented LOLA point product), then compare the point values to the corresponding cells while accounting for GDR binning/interpolation and local terrain variability. Until that evidence exists, keep `scientificallyValidated=false`, validation blocked, map delivery incomplete, and map-ready/renderable counts at zero.
