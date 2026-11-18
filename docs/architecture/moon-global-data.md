# TerraMatch Moon Catalog — Acquired Data Only

## Active catalog rule

The active Moon catalog is intentionally limited to products whose data has been acquired and integrity verified. As of 2026-11-18 it contains one product: NASA LRO LOLA LDEM_4. Metadata pages and prospective product families are not active catalog entries. No Moon discovery results or Earth–Moon analog claims are supported by this dataset alone.

| Dataset | Acquired bytes | Processing | Independent validation | Map readiness |
|---|---|---|---|---|
| LRO LOLA LDEM_4 relative surface height | JP2 1,436,447 bytes; detached PDS label 6,602 bytes; both SHA-256 verified in the external cache and acquisition manifest | Processed Float32 NPY, 4,147,328 bytes; source NoData DN -32768 mapped to NaN; valid height is DN × 0.5 m; array checksum verified | Blocked: no independent point-level LOLA RDR comparison; coverage versus interpolation not measured | No. Three real-data display previews are explicitly unvalidated research previews, not scientific map layers. |

The external raw source location on the acquisition machine is `F:\\terra-moon-cache\\lola`. The repository contains the processed NPY, metadata sidecar, acquisition manifest, and preview derivatives. The NPY checksum is recorded in `data/processed/moon/lola/ldem_4_height_m.json`.

## Source and interpretation

- Official PDS JP2: `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2`.
- Official detached label is colocated as `ldem_4_jp2.lbl`.
- The source label identifies a simple cylindrical grid in the MEAN EARTH/POLAR AXIS OF DE421 frame, positive-east longitude, 4 pixels/degree, and a 720 × 1440 grid. The LOLA SIS defines body-fixed coordinates as planetocentric; GDRDEM documentation says cell values are registered at cell centers.
- Pixel-center mapping is longitude `(column - 719.5) / 4`, latitude `(359.5 - row) / 4`; the processed NPY is still not encoded with a standard lunar CRS/geotransform.
- Relative height is `DN × 0.5 m`. The reference radius 1,737,400 m is metadata only and is not added. AUX NoData `-32768` is NaN in the processed array.
- These semantics do not establish independent scientific validation or observed geographic coverage. The source label notes interpolation and possible edge artifacts.

## Data lifecycle and application behavior

`src/moon/registry/dataset-registry.ts` is the active catalog. Its validator rejects entries without an acquired state and verified checksum. `npm run moon:registry:validate` additionally reads the processed LOLA file and sidecar and recomputes the output size and SHA-256. APIs and the Moon dataset catalog expose only retained entries. Unsupported or unacquired product candidates are not listed as active datasets.

The Moon page can display the actual LOLA-derived global and polar preview images with sampling and product limitations. They remain research previews and do not count as renderable validated layers. Moon environmental discovery and Earth–Moon comparison remain unavailable because no independently validated compatible lunar factors are available.

## Acquisition attempts and inactive candidates

The former 12 metadata-only candidates were removed from the active registry: Kaguya LALT; Diviner; LROC WAC; LROC NAC; Chandrayaan-1 M³; Clementine UVVIS; illumination; permanently shadowed regions; LEND; GRAIL; Mini-RF; and USGS Unified Geologic Map. Their historical audit reports remain as records of prior investigations, but these products and URLs are not served as active catalog entries.

The official USGS GIS v2 package advertises 224,413,040 bytes, but the local request failed with `HttpRequestException`; no archive was obtained. The official ODE/PDS Diviner 00N–10N global cumulative TAB (156,211,313 bytes) was also checked via its direct PDS endpoint, which failed locally with `HttpRequestException`. ODE documents a REST/GDS query mechanism, but no product bytes were obtained through it. JAXA DARTS documents the LALT global grid and its official PDS3 directory/file layout; a direct GET of the small `LALT_GGT_NUM.LBL` from `data.darts.isas.jaxa.jp` failed locally with `HttpRequestException`, so no LALT product bytes were acquired. These independent official-host attempts show that data access is blocked in this local execution environment, not that the providers lack the products. No other prospective family had an acquired, verified data file in the repository/cache audit; unacquired candidates were therefore removed rather than left as promises.

## Reproducible checks

```powershell
npm test
npm run check:web
npm run moon:registry:validate
```

`npm run moon:registry:validate` reports current active counts and checks the processed LOLA artifact integrity. New downloads remain opt-in; no test or normal application command downloads data. Raw source products stay outside Git; no production storage, database, or deployment is involved.

## References

- [LOLA RDR SIS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/rdrsis.htm)
- [LOLA GDRDEM product description](https://ode.rsl.wustl.edu/MArs/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20%28LRO%29/LOLA/GDR/GDRDEM.htm)
- [PDS Geosciences LOLA archive](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/)
- [USGS Unified Geologic Map product metadata](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/)
- [ODE Diviner GCP definition](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/LRO/DIVINER/GCP.htm)
- [JAXA DARTS Kaguya LALT global grid metadata](https://darts.isas.jaxa.jp/datasets/darts:sln-l-lalt-5-topo-ggt-num-v2.0)
- [JAXA DARTS LALT PDS3 data directory](https://data.darts.isas.jaxa.jp/pub/pds3/sln-l-lalt-5-topo-ggt-num-v2.0/)
- [ODE REST/GDS documentation entry](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Additional_Resources/ODE_REST_API.htm)
