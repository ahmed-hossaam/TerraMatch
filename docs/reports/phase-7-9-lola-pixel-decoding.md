# Phase 7–9 — LOLA LDEM_4 Pixel Decoding

## Result

`RESULT: LOLA_PIXELS_DECODED`

The acquired LOLA `LDEM_4` JPEG 2000 was decoded with the isolated decoder environment. This advances only the product's pixel-decoding lifecycle stage. No physical-unit conversion, NoData filtering, processed raster, scientific validation, map delivery, or renderable layer was produced.

## Source integrity and reproducibility

The unchanged external source cache contains `ldem_4.jp2` (1,436,447 bytes; SHA-256 `9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3`) and `ldem_4_jp2.lbl` (6,602 bytes; SHA-256 `102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8`). The decoder script rechecks both exact sizes and hashes before decoding and refuses to overwrite either source or an existing diagnostics output.

- JP2: [official PDS Geosciences product](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2)
- Label: [official PDS Geosciences detached label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl)

Reproduction command (using the separately provisioned Python virtual environment):

```powershell
& '<ISOLATED_PYTHON_EXECUTABLE>' scripts/moon/decode-lola-jp2.py `
  --jp2 '<LOLA_CACHE>/ldem_4.jp2' `
  --label '<LOLA_CACHE>/ldem_4_jp2.lbl' `
  --diagnostics '<LOLA_CACHE>/ldem_4_decode_diagnostics.json'
```

Decoder runtime: Python 3.14.5, `imagecodecs` 2026.11.11, NumPy 2.5.5; decoder entry point `imagecodecs.jpeg2k_decode`. The JSON diagnostics were written outside the repository as `ldem_4_decode_diagnostics.json` in the LOLA cache directory; no local filesystem path is embedded in the tracked report or JSON provenance.

## Actual raw decoded facts

The decoder returned a NumPy array of shape 720 lines × 1,440 samples, dtype `int16` (signed 16-bit), 1,036,800 total samples. All 1,036,800 decoded integer samples are finite. “Finite” is a numerical property only; it does not establish valid-data coverage because the label does not provide a fill/NoData value.

Raw sample diagnostics, before any scale/offset or other physical interpretation:

| Statistic | Raw value |
|---|---:|
| Minimum | -17,758 |
| Maximum | 21,008 |
| Mean | -1,039.5337094907406 |
| Population standard deviation | 4,406.185206969532 |
| Median | -1,593 |
| 1st percentile | -10,641 |
| 5th percentile | -7,649 |
| 25th percentile | -3,808 |
| 50th percentile | -1,593 |
| 75th percentile | 1,249 |
| 95th percentile | 7,163 |
| 99th percentile | 11,362 |
| Count equal to minimum | 1 |
| Count equal to maximum | 1 |

The minimum and maximum exactly match the PDS label's declared minimum and maximum. The decoder-produced first five rows by first ten columns also exactly match the actual values supplied for this decode; the reproducible JSON contains the complete block and additional fixed zero-based sample positions. This agreement checks the decode result against the supplied evidence but does not constitute scientific validation.

## PDS label declarations and scientific limits

The detached PDS3 label declares product `LDEM_4`, product version `V3.0`, dataset `LRO-L-LOLA-4-GDR-V1.0`, target Moon, a 720 × 1,440 image, `SAMPLE_TYPE = LSB_INTEGER`, 16 bits, units of meters, scale factor 0.5, offset 1,737,400, and a simple cylindrical projection. It declares body-fixed `MEAN EARTH/POLAR AXIS OF DE421`, positive-east longitude, bounds −180° to +180° and −90° to +90°, 4 pixels/degree, and pixel registration. It does not specify latitude type and contains no `MISSING_CONSTANT` or `MISSING_VALUE` keyword.

PDS Geosciences describes the general GDR conversion formula as `HEIGHT = (DATA VALUE × SCALING_FACTOR) + OFFSET` and gives the same scale and offset in its [LOLA FAQ](https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm). This task intentionally did not apply that transform: the product description calls the grid a shape map (radius), while the image object is named `HEIGHT` and describes values relative to a reference-radius offset. The raw decoded samples are therefore reported without calling them verified elevation or absolute radius. The [PDS LOLA archive documentation](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/archsis.htm) and FAQ describe GDR/JP2 products generally; product-level interpretation still requires resolving the questions below.

Unresolved:

- No defensible NoData/fill rule was found in this detached label. No valid/rejected pixel count or coverage fraction is reported.
- Planetocentric versus planetographic latitude is not declared by this label.
- The label records pixel registration and projection offsets, but row/column-to-pixel-center mapping and image orientation were not independently verified against a product-specific grid specification or geospatial reader.
- Global declared grid bounds do not establish complete observed or valid coverage.
- The label warns that grid files were made in 45° latitude bands and may have edge artifacts. It also says surface interpolation was used at higher resolutions to compensate for incomplete coverage. The valid/interpolated footprint for this particular raster has not been computed.
- A signed `int16` decoder result is confirmed. The detached label's `LSB_INTEGER` describes the PDS image representation; this report does not claim that NumPy's in-memory byte order independently verifies source byte order.

## Lifecycle after this task

| Stage | LDEM_4 state |
|---|---|
| Source acquired | Acquired; source files are in the external cache |
| Source checksum verified | Verified against both supplied SHA-256 values |
| Label/header inspected | Completed |
| Pixels decoded | **Completed** |
| Processed | Not started |
| Scientifically validated | Not completed; validation remains blocked |
| Delivery ready | Not started |
| Renderable / map ready | No; Moon layer remains unavailable as `not_processed` |

The API reports one decoded product, zero processed/validated products, and zero renderable layers. Other LOLA products and the other 12 Moon dataset families have not thereby been acquired.

## Files and verification

Created: `scripts/moon/decode-lola-jp2.py`, `src/moon/validation/lola-diagnostics.ts`, `tests/moon-lola-decoding.test.ts`, and this report. Updated the LOLA registry lifecycle and truthful decode-status copy in the Moon API/UI; updated regression expectations and the reports index. The historical acquisition manifest and earlier “decode blocked” report were left intact as records of their earlier state.

- `npm test`: **145 passed, 0 failed**.
- `npm run check:web`: passed.
- `npm run moon:registry:validate`: passed; 13 dataset families, 1 acquired, 0 processed, 0 validated, 0 map-ready, no registry errors.
- The new TypeScript diagnostics validator was run against the actual external JSON: valid, no schema/safety errors. Its pixel-grid block matched the supplied values exactly.
- No web build was run, to avoid rewriting the two protected pre-existing MapLibre assets. No Mars or Earth source data, behavior, or validation artifacts were changed by this task. The full test suite includes Mars/Earth regression coverage.
- No processed raster, GeoTIFF, map tiles, or Moon map layer was created. No dependencies, package manifests, environment settings, databases, production resources, Git history, or deployments were changed. No commit or push was made.

Starting and ending commit: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`; branch remains `backend-preview-integration`. Existing unrelated working-tree changes were preserved.
