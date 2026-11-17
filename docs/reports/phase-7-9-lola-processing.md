# Phase 7–9 — Process LOLA LDEM_4 Relative Height

## Result

`RESULT: LOLA_PROCESSED`

The real `LDEM_4` JP2 was decoded again after verifying the JP2 and PDS label hashes. The companion AUX XML was parsed and checked for its NoData, scale, offset, and raw-range declarations. A Float32 relative-height array and metadata sidecar were generated and read back successfully. This is a processed numeric array only: it is not georeferenced, scientifically validated, delivery-ready, map-ready, or renderable.

## Inputs and integrity

| Input | Size | SHA-256 | Verification |
|---|---:|---|---|
| `ldem_4.jp2` | 1,436,447 bytes | `9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3` | Exact expected size and digest matched |
| `ldem_4_jp2.lbl` | 6,602 bytes | `102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8` | Exact expected size and digest matched |
| `ldem_4_aux.xml` | 2,032 bytes | `64D09F1B634C4EFC8BA5310AD92E6B9DDB9AA216D60081A61AB3BD2E4EC7076D` | Parsed; observed digest recorded |

The source files remain in the external cache and were not modified. Official product and label sources: [LOLA JP2](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2), [detached PDS label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl).

The companion AUX declares `NoDataValue=-32768`, `Scale=0.5`, and `Offset=0`. Its `actual_range` is −17,757.642578125 to 21,008.28515625; decoded non-NoData raw extrema were within 1 DN of these declarations. The processing script fails if the AUX metadata differs from the expected values or the range check fails.

## Processing and output

The source decoded to 720 × 1,440 signed `int16`. The processed output is [ldem_4_height_m.npy](/F:/terra-x/data/processed/moon/lola/ldem_4_height_m.npy), a 720 × 1,440 Float32 NumPy array. The sidecar is [ldem_4_height_m.json](/F:/terra-x/data/processed/moon/lola/ldem_4_height_m.json).

The exact rule was:

- Raw DN `-32768` → Float32 `NaN`.
- Other samples → relative surface height in meters, `DN × 0.5`.
- AUX offset `0` is recorded and applied; the PDS reference radius `1,737,400 m` is metadata only and is **not** added to the relative-height output.
- The alternate planetary-radius formula (`DN × 0.5 + 1,737,400 m`) was not used.

Reproduction command; replace placeholders with the already provisioned isolated Python executable and external cache directory:

```powershell
& '<ISOLATED_PYTHON_EXECUTABLE>' scripts/moon/process-lola-height.py `
  --jp2 '<LOLA_CACHE>/ldem_4.jp2' `
  --label '<LOLA_CACHE>/ldem_4_jp2.lbl' `
  --aux '<LOLA_CACHE>/ldem_4_aux.xml' `
  --output data/processed/moon/lola/ldem_4_height_m.npy `
  --metadata data/processed/moon/lola/ldem_4_height_m.json
```

Runtime: Python 3.14.5, imagecodecs 2026.11.11, NumPy 2.5.5. The NPY artifact is 4,147,328 bytes with SHA-256 `6D750B3134F9F8272913E70793F3140DC6CE2FD857865BD9F28DD7885123D417`. The script reopens the saved NPY and verifies dimensions, dtype, NaN count, and checksum against the sidecar.

## Sample counts and processed statistics

| Count | Result |
|---|---:|
| Total samples | 1,036,800 |
| Valid under the AUX NoData rule | 1,036,800 |
| NoData samples (`-32768`) | 0 |
| NoData sample locations | None; zero-based location list is empty |

Processed valid-sample statistics in meters (computed from the Float32 values, with float64 accumulation for the mean and population standard deviation):

| Statistic | Value (m) |
|---|---:|
| Minimum | −8,879 |
| Maximum | 10,504 |
| Mean | −519.7668547453703 |
| Population standard deviation | 2,203.092603484766 |
| Median | −796.5 |
| 1st percentile | −5,320.5 |
| 5th percentile | −3,824.5 |
| 25th percentile | −1,904 |
| 50th percentile | −796.5 |
| 75th percentile | 624.5 |
| 95th percentile | 3,581.5 |
| 99th percentile | 5,681 |

All samples are valid only relative to the declared AUX sentinel. This count is not geographic coverage and does not imply every grid cell is an independent observation or free of interpolation/artifacts.

## Coordinate metadata and limitations

The sidecar preserves PDS label declarations: Moon target, body-fixed Mean Earth/Polar Axis of DE421 frame, simple cylindrical projection, positive-east longitude, declared grid bounds −180° to +180° and −90° to +90°, 4 pixels/degree, and a 1,737,400 m reference radius. It does not assign a geotransform and explicitly says `georeferenced: false`.

Latitude convention (planetocentric vs planetographic) remains unresolved. Pixel-center coordinates and row/column orientation have not been verified. The PDS label calls the product a shape map (radius), while its image object is named `HEIGHT`; this artifact follows the requested relative-height formula but does not resolve the source wording. The label also notes possible 45° latitude-band edge artifacts and interpolation to compensate for incomplete coverage. No spatial coverage estimate or quality mask was calculated.

## Lifecycle and integration

Only the LOLA LDEM_4 product was advanced: source acquired, checksums verified, inspected, decoded, and processed. The registry and Moon API report one processed product. Scientific validation remains blocked; map delivery remains not started; renderable/map-ready count remains zero. The other 12 Moon families are unchanged. No Earth or Mars datasets or behavior were changed.

## Tests and verification

- Python processing unit tests: **3 passed**. They use small explicitly synthetic arrays/XML and test sentinel masking, scale, NaN behavior, dtype/dimension rejection, and AUX parsing; they are not scientific source fixtures.
- Focused Moon tests (`node --test dist/tests/moon-*.test.js`): **35 passed**.
- `npm test`: **147 passed, 0 failed**.
- `npm run moon:registry:validate`: passed; 13 families, one acquired/processed, zero scientifically validated or map-ready, no registry errors.
- The TypeScript processed-metadata validator was run against the generated sidecar and passed; the actual saved NPY checksum, shape, dtype, and NaN count were independently checked by the processing script.
- No deployment, migration, production setting, Git operation, or dependency change occurred. Mars/Earth source data and behavior were preserved. Protected MapLibre assets were not touched; no web build was run.

Starting/ending commit remains `46b834d7b01080ab839e1d05f513fabc6ddd8f4a` on `backend-preview-integration`; existing unrelated working-tree changes were preserved.
