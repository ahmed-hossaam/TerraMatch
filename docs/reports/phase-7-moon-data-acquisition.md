# Phase 7 — Real Moon Data Acquisition

## Outcome

**Partially complete; no product was acquired.** The official product metadata investigation produced one precisely identified, small LOLA global grid that is technically suitable for controlled acquisition. The local execution environment could not complete a network request to the PDS file host (`Invoke-WebRequest` failed with `HttpRequestException`), so no source bytes, checksum, or artifact manifest were obtained. The registry remains truthful: zero acquired products.

## Starting state and safeguards

- Branch: `backend-preview-integration`; starting HEAD: `46b834d`.
- The working tree already contained uncommitted Phase 2–6 implementation and reports. All were preserved.
- Existing modified `web-dist/assets/maplibre-gl-BJqcOGhp.js` and `web-dist/assets/maplibre-gl-worker-Dlv-oLtU.js` were not edited by this phase.
- No deployment, migration, database/Blob write, Git staging, commit, or push occurred.
- Network attempt was a bounded HEAD request only; it did not create or modify an artifact.

## Product findings

| Family | Official record reviewed | Exact product evidence | Acquisition result |
|---|---|---|---|
| LOLA | [PDS LOLA FAQ](https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm), [official PDS GDR directory](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/), [LDEM_4 PDS label](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4_jp2.lbl) | Dataset `LRO-L-LOLA-4-GDR-V1.0`; product `LDEM_4`; product version `V3.0`; 4 pixels/degree, 720×1440; 1,436,447 bytes; JP2. URL: `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/DATA/LOLA_GDR/cylindrical/jp2/ldem_4.jp2`. Label states simple cylindrical, body-fixed Mean Earth/Polar Axis of DE421, positive-east, −180°..180°, 1,737.4 km radius, values scaled by 0.5 with 1,737,400 m offset. The product was built through 2016-11-29; label describes edge artifacts at 45° bands and interpolation to compensate for incomplete coverage. | **Not acquired.** Local PDS request failed before response; checksum unavailable. PDS provides the official detached label and file size, not an observed local artifact. No redistribution determination from the inspected label; license remains unverified. |
| USGS Unified Geologic Map | [USGS Astrogeology product page](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/) | Edition 2.0, published 2020-03-03; global 1:5,000,000 map; package `Unified_Geologic_Map_of_the_Moon_GIS_v2.zip`, 224,413,040 bytes; official URL `https://asc-astropedia.s3.us-west-2.amazonaws.com/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2.zip`; CC0 with author citation requested. USGS page declares target Moon, 1,737,400 m spherical radius, planetocentric latitude, positive-east longitude, −180..180 and Mercator. It describes interpreted unit polygons, contacts, line features and nomenclature; bundled relief source imagery is excluded from the download. | **Not acquired.** The package is ~224 MB, requires GIS inspection, and the local network request was unavailable. No files were extracted or inspected. CC0 status is documented by USGS; citation remains required. |
| Diviner | [PDS Diviner mission page](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm), [Diviner Derived Products SIS](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/document/Diviner_RDR_SIS.pdf), [PDS archive SIS](https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1001/document/dp_archsis.pdf) | GCP dataset `LRO-L-DLRE-5-GCP-V1.0`; GCP files are ASCII `.TAB` with detached labels, global 10° latitude bands, 2 pixels/degree. PCP is a distinct PDS4 collection (`urn:nasa:pds:lro_diviner_derived1:data_derived_pcp::1.0`), polar-stereographic 240 m bins, with separate local-time/solar-longitude products. Archive SIS size estimates: GCP ~156 MB per product and 18 products (~2.7 GB); PCP products 70–290 MB, about 151 GB total. These are archive estimates, not downloaded file sizes. Brightness temperature is a derived radiometric variable, not lunar air temperature. | **Not acquired.** No exact bounded GCP file/label pair was downloaded or locally inspected. Product family and syntax are documented, but per-file variables, fill/QC fields, checksum, and redistribution details remain unverified for a selected artifact. |

Official information does not establish that all three archives are suitable for immediate browser delivery. The USGS package needs safe GIS inspection. LOLA JP2 is a compressed global grid, but the current application has no JP2 decoder/delivery path verified. Diviner has distinct global and polar products that must not be combined.

## Implementation completed

- Added `src/moon/validation/acquisition-manifest.ts`, a strict versioned manifest contract and validator for source identity, timestamps, checksum, coordinate reference, variable semantics/units, quality, license/attribution and limitations. It rejects local path/secret leakage and unsupported acquisition outcomes.
- Added `tests/moon-acquisition-manifest.test.ts`, using only a clearly identified synthetic test fixture.
- Hardened `scripts/moon/bounded-acquisition.mjs`: filesystem conflicts, permission/capacity errors, checksum/size failures, and overwrite conflicts are not retried as if they were transient network errors.
- No registry entry was marked acquired; no Moon product or fake measurement was added.

## Verification

- `npm run build`: passed.
- Focused acquisition tests: **8 passed, 0 failed** (`node --test dist/tests/moon-acquisition-manifest.test.js tests/moon-acquisition.test.mjs`).
- Safe network HEAD to the exact LOLA PDS file URL: failed with `HttpRequestException`; no response body or data file was retrieved.
- Product acquisition and product-file validation: **not performed**, because the bytes were unavailable.

## Acceptance and remaining blocker

The bounded acquisition path and manifest validation are implemented and tested. The required real-product acquisition criterion is **not met**. The precise blocker is network access from this execution environment to the public PDS download host. A later acquisition can use the existing `moon:acquire:baseline` command with an explicit external cache path, size cap, and checksum if the PDS host is reachable. The LOLA candidate is the most practical first acquisition: small, exact, and labeled, but its image format still needs a tested decoder before map delivery.
