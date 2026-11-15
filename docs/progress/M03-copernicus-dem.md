# M03 — Copernicus DEM elevation ingestion

## Status

**Complete for the five-site prototype sample.** All five sites were sampled from public Copernicus GLO-30 COGs, raw point records were saved separately, and normalized records passed validation. Values below are surface-model pixel elevations, not guaranteed bare-earth or field-site elevations. All atlas coordinates are approximate.

## Architecture and files

- `src/data-sources/copernicus-dem/config.ts` resolves AWS one-degree GLO-30 COG object names and maps geographic coordinates into a pixel using the GeoTIFF affine georeference.
- `src/data-sources/copernicus-dem/retrieve.ts` uses `geotiff` remote range reading, checks CRS/dimensions/georeferencing, reads only a one-pixel window, preserves NoData as null, records actual sample pixel center and spacing, and handles timeouts/retries.
- `scripts/retrieve-copernicus-dem.ts` retrieves configured sites, reuses valid raw samples, refuses mismatched overwrites, and writes the retrieval report.
- `src/data-sources/copernicus-dem/normalize.ts` verifies site/provenance/units and records DSM and coordinate uncertainty limits.
- `scripts/ingest-copernicus-dem.ts` normalizes raw samples into `data/processed/terrain/elevation-samples.json` and writes a validation report.
- `tests/copernicus-dem.test.ts` covers tile mapping, negative longitude tile naming, exact boundary pixel handling, metadata, CRS, NoData, values, and source failures.
- `package.json` and `package-lock.json` declare/lock `geotiff` 3.0.5. No Python processing component remains.

## Retrieval result

Product: `COP-DEM_GLO-30-Public`, Copernicus DEM 2021 release. Raster GeoKeys verified horizontal CRS EPSG:4326; source heights are meters relative to EGM2008. Each source pixel is nominally one arc-second (about 30 m; longitude ground spacing varies by latitude). Copernicus GLO-30 is a DSM and may include buildings and vegetation.

| Site | Requested atlas point | Sample pixel center | Elevation (m) | Tile |
|---|---|---|---:|---|
| GKC | 22.8, 26.2 | 22.7998611, 26.2001389 | 749.9042 | N22 E026 |
| GKB | 23.5, 26.0 | 23.4998611, 26.0001389 | 1036.0649 | N23 E026 |
| WDE | 22.0, 28.5 | 22.0001389, 28.5001389 | 296.9119 | N22 E028 |
| KHA | 25.45, 30.55 | 25.4498611, 30.5501389 | 81.8603 | N25 E030 |
| RTI | 37.69, -6.56 | 37.6898611, -6.5598611 | 308.9146 | N37 W007 |

Successful sample count: **5/5**; failed/missing values: **0**. Initial live validation caught two resolver issues: exact southern raster-edge coordinates and west-tile naming. Raster bounds were inspected from the actual COGs; the resolver/pixel-boundary logic was corrected, and only WDE and RTI were re-retrieved. The original successful raw files were reused. Final all-site normalized output was rebuilt and validated.

Raw per-site sample JSON and `retrieval-report.json` are under `data/raw/copernicus-dem/`. Normalized records and `validation-report.json` are under `data/processed/terrain/`. The source note documents licensing/attribution and product meaning at [Copernicus DEM source note](../data-sources/copernicus-dem.md).

## Commands

```powershell
npm install
npm.cmd test
npm.cmd run extract:copernicus-dem
npm.cmd run ingest:copernicus-dem
npm.cmd run retrieve:copernicus-dem
npm.cmd run validate:copernicus-dem
```

Set `COPERNICUS_SITE_IDS` to a comma-separated subset and `COPERNICUS_RAW_DIR` to change raw storage. Existing valid per-site records are reused; pass `--force` to the extraction script only when a deliberate refresh is needed. Extraction runs in Node.js with `geotiff` and does not require a separate geospatial runtime.

## Limitations and next step

- The five atlas coordinates are approximate; local samples may not cover the named geologic feature. Pixel values do not establish exact site elevation.
- The product is a DSM, not bare-earth terrain, and its accuracy statements are global product statistics rather than site-specific error bounds.
- This milestone measures elevation only; it does not calculate slope, roughness, terrain diversity, suitability, or similarity.
- Next: M04 GLiM point lithology retrieval and evidence provenance.
