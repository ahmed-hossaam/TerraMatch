# Phase 7–9 — First Acquired LOLA Product

## Result

**`LOLA_DECODE_BLOCKED`**. The supplied LDEM_4 JP2 and detached PDS label exist in the external cache, their byte sizes and SHA-256 digests match the supplied expected values, and their label/container metadata were inspected. No compatible JPEG 2000 pixel decoder is installed in this execution environment. Therefore no pixels, statistics, valid-data coverage, processed raster, or map layer were produced. This report does not describe header inspection as decoding.

## Scope and Git state

- Branch: `backend-preview-integration`
- Starting and ending HEAD: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`
- The working tree already contained the Phase 2–9 implementation and unrelated local modifications. Those were preserved.
- No commit, push, deployment, database migration, or production change occurred.
- The original source cache files were read only. The two protected pre-existing `web-dist/assets/maplibre-gl*` modifications were not used as build outputs; the web build was redirected to a temporary directory.

## Source files and integrity

Source cache directory: `F:\terra-moon-cache\lola\` (external to the repository).

| Source artifact | Official URL | Actual size | SHA-256 | Result |
|---|---|---:|---|---|
| `ldem_4.jp2` | [PDS Geosciences Node LDEM_4 JP2](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2) | 1,436,447 bytes | `9193828F6FC311E858A9F30CA8A29F91948805993A1475C6D2165E290F167FE3` | Matched supplied expected size and digest |
| `ldem_4_jp2.lbl` | [PDS Geosciences Node detached label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl) | 6,602 bytes | `102122E68A0CCA9106FE0067D2E5027714D244FFDEC87F04FA292A211F0EF4C8` | Matched supplied expected size and digest |

The digests above were computed locally with Node.js SHA-256. The values supplied for comparison were provided in this task; the detached label does not publish an independent checksum. The acquisition time is unknown and is represented as `null`, rather than inferred from the file timestamps.

## Label and JP2 inspection

The complete detached PDS3 label was read and parsed by the repository PDS label inspector. It identifies dataset `LRO-L-LOLA-4-GDR-V1.0`, product `LDEM_4`, product version `V3.0`, target Moon, producer LRO LOLA team / NASA Goddard Space Flight Center, creation date `2017-09-15`, and source-data interval `2009-07-13T17:33:17.246` through `2016-11-29T05:48:19`.

The uncompressed `IMAGE` object described by the label is 720 lines × 1,440 samples, `LSB_INTEGER`, 16 bits, meters, scale factor `0.5`, offset `1,737,400 m`, and declared minimum/maximum `-17,758` / `21,008`. Those min/max values are label metadata; they were not recalculated from pixels. The JP2 codestream header independently declares 1,440 × 720, one component, signed 16-bit precision, unit horizontal/vertical subsampling, and one 1,440 × 720 tile. This is header inspection only; the decoded sample type, decoded byte/sample behavior, and pixel values were not verified.

The label names the product a shape map (radius), while its `IMAGE` object says each sample represents height relative to a reference-radius offset. The `OFFSET` is `1,737,400 m`. No scale/offset transformation was applied, and the registry retains this source terminology instead of asserting that decoded values are terrain elevation or absolute radius.

Map metadata declares a simple cylindrical projection, 4 pixels/degree, 1,737.4 km spherical axes, positive-east longitude, longitude bounds −180° to +180°, latitude bounds −90° to +90°, line/sample projection offsets 359.5 / 719.5 pixels, and the body-fixed rotating Mean Earth/Polar Axis of DE421 frame. The description says pixel registered. No explicit latitude type keyword was present, so latitude remains unknown. The label also says 45° latitude-band edge artifacts may occur and that surface interpolation was used at higher resolutions to compensate for incomplete coverage. Full grid bounds do not establish observed or valid coverage.

No `MISSING_CONSTANT` or `MISSING_VALUE` is declared in the detached label. A fill/NoData rule and quality mask could not be established. Thus valid/rejected sample counts and all raster statistics remain unavailable.

## Decoder and processing outcome

The repository PDS helper parsed the detached label and the JP2 box/SIZ header. System capability checks found no `gdalinfo`, `gdal_translate`, `ffmpeg`, ImageMagick `magick`, or `opj_decompress` command; no compatible JP2 decoder dependency was already installed in the project. The existing `geotiff` dependency does not establish JPEG 2000 decoding support. No dependency was installed.

Because pixels could not be decoded, none of the following was performed: raster statistics, fill-value filtering, scale/offset application, orientation validation, longitude/latitude pixel-center checks, valid/invalid pixel counts, coverage calculations, reprojection, GeoTIFF conversion, tile generation, or renderer delivery. No processed artifact exists. This is a decoder blocker, not a failed scientific measurement.

## Acquisition manifest and lifecycle

Added a compact provenance record at `data/raw/moon/acquisition-manifests/lola-ldem-4-v3.json`. It records both source artifacts, source URLs, filenames, sizes, digests, acquisition time as unknown, label/header metadata, unresolved coordinate/NoData semantics, and explicit limits. It contains no raw raster bytes or local cache path. The original cache files remain outside Git and unchanged.

Current LOLA `LDEM_4` lifecycle:

| Stage | State | Evidence |
|---|---|---|
| Registered | Complete | Existing Moon registry record |
| Product selected | Complete | Specific `LDEM_4` V3.0 product |
| Metadata review | Partial | Actual detached PDS label reviewed; some fields unresolved |
| Source acquired | Acquired | Both supplied cache artifacts are present and match expected hashes |
| File/header inspected | Complete | Full PDS label and JP2 container/SIZ structure inspected |
| Pixel decoded | **Blocked** | No compatible decoder is installed |
| Processed | Not started | Requires decoded pixels and defensible NoData/QC rules |
| Product validated | **Blocked** | Pixel-level validation cannot occur before decoding |
| Map delivery | Not started | No validated delivery artifact or tile source exists |
| Renderable | **No** | Moon map reports `decode_blocked`; no scientific LOLA layer is selectable/rendered |

The API summary therefore reports one acquired and file-inspected dataset family, zero decoded, processed, validated, and renderable products. The other 12 dataset families remain unacquired. No observed, valid, interpolated, or unobserved coverage percentage is inferred.

## Files changed for this continuation

- `src/moon/processing/pds3-raster.ts` — parse unit-suffixed PDS numeric fields and projection fields; inspect JP2 signature/boxes/SIZ metadata without claiming decompression.
- `src/moon/products/contracts.ts` — add a separate pixel-decoding lifecycle state.
- `src/moon/registry/dataset-registry.ts` — describe the acquired LDEM_4 artifact and its label semantics/limitations.
- `src/moon/validation/registry.ts` — enforce ordered inspection, decoding, processing, validation, and delivery gates.
- `src/moon/validation/acquisition-manifest.ts` — allow explicitly unknown retrieval time and source CRS latitude type; validate companion-artifact provenance.
- `src/moon/map-layers.ts`, `src/moon/api.ts` — distinguish acquired-but-undecoded from unacquired data and prevent rendering.
- `web/src/MoonPage.tsx`, `web/src/MoonEvidencePage.tsx`, `web/src/moon/moon-api.ts` — expose acquisition, inspection, and blocked pixel-decoding states honestly.
- `tests/moon-processing.test.ts`, `tests/moon-acquisition-manifest.test.ts`, `tests/moon-architecture.test.ts`, `tests/moon-api.test.ts`, `tests/moon-map.test.ts`, `tests/moon-evidence.test.ts`, `tests/app-api.test.mjs` — cover parsing, header inspection, manifest validation, and API/map lifecycle behavior.
- `data/raw/moon/acquisition-manifests/lola-ldem-4-v3.json` — source-derived, compact artifact manifest.
- `docs/reports/README.md` — link to this report.

## Verification

- Actual source sizes and SHA-256: **both matched** the task-supplied expectations.
- Actual PDS label parse: **completed**; product fields and declared grid metadata extracted. Latitude type and NoData remain unknown.
- Actual JP2 signature/container/SIZ header parse: **completed**; header dimensions agree with label.
- Actual pixel decode and raster statistics: **not performed / blocked**.
- Focused Moon tests: **30 passed, 0 failed**.
- `npm test`: **143 passed, 0 failed**.
- `npm run check:web`: **passed**.
- `npm run build:vercel`: **passed**; Vercel workflow build compiled 24 steps. Existing large-chunk warnings remain. The Nitro trace noted a Windows builder environment; deployment was not attempted.
- Web production build: **passed** using Vite with an external temporary `--outDir` so the protected `web-dist/assets/maplibre-gl*` files were not overwritten.
- Mars REMS validator: **valid**; source record count, valid/rejected REMS counts, and Earth site IDs were reported by the existing validator.
- Data validator: **valid** (26 known sites and 3 candidate fixtures).
- Reference validator: **valid** (31 references).
- Mission-profile validator: **valid** (4 missions, 5 dimensions, 19 factors).
- Evidence validator: **valid** (589 factor rows and 199 supplemental records).
- Discovery validator: **valid**.
- Comparison validator: **valid** (24 point-eligible references; 24 pairs for the current stored run).
- Moon registry validator: **valid** (13 families; 1 source acquired; 0 processed, validated, or map-ready).
- Browser test: **not run**.

Validators that normally write reports were directed to generated files under `dist/`; the five tracked validation reports that a failed PowerShell wrapper initially touched were restored byte-for-byte from the clean starting commit before final verification. No scientific source records, historical discovery/comparison runs, Mars REMS data, Earth reference data, environment variables, production resources, or Git history were changed.

## Remaining blocker and next step

Install or provide an already-supported JPEG 2000 decoder in a controlled local processing environment, then decode the source and independently check its output against the label. Before interpreting pixel values, obtain/verify the product's fill/NoData and latitude convention from applicable PDS documentation or auxiliary metadata. Only after those checks should a processed raster format and delivery strategy be selected. Until then, the LOLA layer must remain unavailable.
