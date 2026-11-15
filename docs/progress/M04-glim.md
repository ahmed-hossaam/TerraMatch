# M04 — GLiM point lithology integration

## Status

**Complete for the five-site prototype sample.** Live point-in-polygon queries returned one mapped feature for each of the five known sites. Raw ArcGIS responses were saved, normalized records were rebuilt from raw files, and validation reported 5 mapped, 0 ambiguous, 0 missing/No Data, and 0 failed records.

## Implementation and files

- `src/data-sources/glim/config.ts` validates coordinates and builds a longitude-first ArcGIS point query in EPSG:4326.
- `src/data-sources/glim/client.ts` retrieves and checks parent service and layer metadata before each point lookup, validates GLiM v1.1, polygon geometry, advertised query capability, spatial reference, required fields, and intersection support. It handles ArcGIS/HTTP errors, timeout, and retries for transient failures.
- `src/data-sources/glim/normalize.ts` retains every intersecting feature, geometry, and original attribute; levels `xx`, `yy`, and `zz` remain separate. Empty/multiple/missing/No Data responses have explicit statuses, approximate-coordinate warnings are retained, and no minerals are inferred.
- `scripts/retrieve-glim.ts` retrieves configurable site IDs, reuses valid raw responses, refuses mismatched overwrites, and saves the raw retrieval report.
- `scripts/rebuild-glim.ts` validates and normalizes raw responses without making network calls and writes `data/processed/geology/known-sites-glim.json` plus `validation-report.json`.
- `tests/glim.test.ts` covers query construction and coordinate order, CRS, response parsing, empty/multiple/missing features, No Data, ArcGIS/HTTP errors, retry behavior, provenance, and approximate-coordinate warnings.
- `docs/data-sources/glim.md` records verified source metadata and limitations.

The parent FeatureServer description identifies GLiM v1.1; its layer 1 is a polygon feature layer in Web Mercator (WKID 102100/latest 3857), advertises query and `esriSpatialRelIntersects`, and exposes OBJECTID, IDENTITY_, Litho, `xx`/`yy`/`zz`, and their description fields. The code checks those service facts at runtime. Query points use x=longitude/y=latitude and EPSG:4326; result geometry is requested in EPSG:4326. The ArcGIS layer metadata cites Hartmann & Moosdorf (2012) and Moosdorf & Hartmann (2015) but does not state a separate license.

## Actual point lookup results

Each query returned one feature. The table preserves the actual codes and the original service’s level descriptions; it is mapped-area evidence at approximate coordinates, not field verification.

| Site | OBJECTID | `Litho` | xx description | yy description | zz |
|---|---:|---|---|---|---|
| GKC | 936054 | `smmx__` | Mixed sedimentary rocks (`sm`) | Mixed grain size (`mx`) | `__` |
| GKB | 935813 | `ssmx__` | Siliciclastic sedimentary rocks (`ss`) | Mixed grain size (`mx`) | `__` |
| WDE | 935600 | `suds__` | Unconsolidated sediments (`su`) | Dune sands (`ds`) | `__` |
| KHA | 935449 | `ssmx__` | Siliciclastic sedimentary rocks (`ss`) | Mixed grain size (`mx`) | `__` |
| RTI | 410261 | `vipy__` | Intermediate volcanic rocks (`vi`) | Pyroclastics mentioned (`py`) | `__` |

The `Litho` values are retained as source strings; they are not treated as mineral measurements. Empty mineral evidence remains separate. All five site coordinates carry `coordinatesApproximate: true` and corresponding warnings. Raw files are under `data/raw/glim/`; normalized results and reports are under `data/processed/geology/`.

## Commands and verification

```powershell
npm.cmd test
npm.cmd run retrieve:glim
npm.cmd run rebuild:glim
npm.cmd run validate:glim
```

`GLIM_SITE_IDS` configures a comma-separated subset; `GLIM_RAW_DIR`, `GLIM_TIMEOUT_MS`, and `GLIM_RETRIES` configure storage and request behavior. The live run completed with 5/5 successes. `validate:glim` rebuilt from the saved raw responses and reported five mapped records with no failures.

## Limitations and next step

- GLiM reports about 1.2 million polygons and average map scale approximately 1:3,750,000; actual source scales and polygon generalization vary. A point hit does not validate the named site's precise geology.
- The source classification represents lithology and mapped-unit notes; it does not prove minerals are present at a precise point. This pipeline does not infer mineral records.
- The layer's metadata does not explicitly establish a separate redistribution license. Citation is retained; confirm reuse terms before republishing provider attributes or polygons.
- Next: M05 mission-profile data-quality rules and blind benchmark preparation; no score or mission ranking is calculated here.
