# Moon source reassessment — 2026-11-18

## Implemented source corrections

The LOLA LDEM_4 registry and processed sidecar now use the spatial conventions supported by the product label and official LOLA documentation. The product remains processed, not independently validated, delivery-ready, renderable, or map-ready.

- The LDEM_4 label identifies `MEAN EARTH/POLAR AXIS OF DE421`, simple cylindrical projection, positive-east longitude, `[-180, 180]` longitude bounds, 4 pixels/degree, `LINE_PROJECTION_OFFSET=359.5`, and `SAMPLE_PROJECTION_OFFSET=719.5`.
- The LOLA RDR SIS defines LRO LOLA spatial coordinates as Moon body-fixed/planetocentric in the Mean-Earth/polar-axis frame, with east-positive longitude. The GDRDEM documentation says a pixel represents the mean at the center of its bounded cell.
- Therefore zero-based source pixel centers are `longitude = (column - 719.5) / 4` and `latitude = (359.5 - row) / 4`. Column increases east; row 0 is north and rows increase south.
- The NPY remains an array without an encoded standard lunar CRS or GeoTIFF geotransform. Coordinate mapping documentation does not constitute independent scientific validation.

Official references:

- [LOLA RDR SIS, coordinate systems and GDR product description](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/document/rdrsis.htm)
- [LOLA GDRDEM product description](https://ode.rsl.wustl.edu/MArs/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20%28LRO%29/LOLA/GDR/GDRDEM.htm)
- [PDS Geosciences LOLA FAQ](https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm)

## Second product candidate: USGS unified geology

The official USGS Astrogeology catalog describes the 2020 GIS v2 Unified Geologic Map as a global interpreted map at 1:5,000,000 scale. It declares a spherical 1,737,400 m reference radius, planetocentric latitude, positive-east longitude from −180° to 180°, and Mercator projection. The catalog lists a 224,413,040-byte ZIP and CC0 terms with an author-citation request. The registry now records the exact direct ZIP endpoint, advertised size, license, and attribution separately from the metadata page.

- Metadata: [USGS Astrogeology GIS v2 product page](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/)
- Data: [Official GIS v2 ZIP](https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2.zip)

The archive was **not acquired**. A local Node `fetch(HEAD)` to the official S3 endpoint failed with `TypeError: fetch failed`; local PowerShell `Invoke-WebRequest -Method Head` to official Copernicus S3 endpoints failed with `HttpRequestException`. The web source lookup supplied USGS catalog metadata, not the archive bytes. No alternate mirror was treated as verified or used. The archive's internal GIS formats, unit dictionary, and per-feature validity remain uninspected.

## Current Moon status after catalog cleanup

| Stage | Count / status |
|---|---:|
| Active catalog entries | 1 (LOLA LDEM_4) |
| Acquired and source checksum-verified | 1 |
| Processed | 1 |
| Independently validated | 0 |
| Renderable scientific layers | 0 |

The former 12 metadata-only candidates were removed from the active registry and API. Historical phase reports retain their original counts as records of earlier implementation states. The LOLA global and polar PNGs remain coordinate-aware **unvalidated research previews**. No independent RDR point check has been completed, and observed versus interpolated geographic coverage has not been calculated. No Moon discovery or Earth–Moon comparison is enabled on this basis.

## Verification

The active source metadata contract now contains only the acquired LOLA product. The bounded acquisition adapter remains reusable, but no unacquired candidate URL is exposed by the active catalog or public API. Its LOLA output checksum is recalculated by the registry validation command.

No raw lunar archive was downloaded. No raster, NPY, PNG, production resource, database, or deployment setting was changed by this reassessment.

## Local verification (2026-11-18)

- `npm test`: passed, 178 tests, 0 failures (includes TypeScript build).
- `npm run check:web`: passed.
- `npm run moon:registry:validate`: passed; 1 registered, 1 acquired, 1 processed, 0 validated, 0 map-ready; no registry errors.
- `npm run validate:mars-rems`: passed; 10 selected sols, 335,521 source records, 249,657 accepted samples, 85,864 rejected samples, four mission profiles.
- `node scripts/moon/acquire-product.mjs ... --dry-run` for the registered USGS GIS v2 endpoint: passed validation in dry-run mode; no bytes downloaded.
- `git diff --check`: passed (Git emitted only existing LF/CRLF working-copy warnings).
- Processed NPY SHA-256 remains `6D750B3134F9F8272913E70793F3140DC6CE2FD857865BD9F28DD7885123D417`. Protected MapLibre bundle hashes remain unchanged.

No browser acceptance was performed in this reassessment. No source archive was acquired, no processed raster was regenerated, and no Moon discovery/comparison was enabled. The repository remains an unvalidated LOLA research-preview integration; it is not a scientifically validated Moon analog workflow.
