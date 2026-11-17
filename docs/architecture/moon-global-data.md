# TerraMatch Moon Data Architecture (Phase 2–3)

## Status and scope

This document describes the Moon destination contracts, product registry, local acquisition foundation, and validation added as Phase 2–3 groundwork. It does **not** claim that any lunar product has been downloaded, processed into a scientific artifact, validated from source files, or delivered as map tiles.

| Capability | Current state |
|---|---|
| Earth/Mars/Moon destination registry | Implemented; Moon coordinate reference is provisional. |
| Lunar longitude convention and geographic/Mercator helpers | Implemented for positive-east/west conversion and spherical lunar Mercator only. Polar stereographic and other source projections are explicitly unsupported. |
| Scientific product metadata contract | Implemented; unknown fields remain null/unknown. |
| 13 Moon product-family registry entries | Registered. Product-specific status appears per entry in `src/moon/registry/dataset-registry.ts`. |
| Bounded HTTPS acquisition | Implemented; explicit source URL, absolute output outside repository, byte limit, retry limit and optional checksum are required. |
| Product metadata snapshot command | Implemented, dry-run by default. |
| LOLA and USGS baseline raw acquisition | Not acquired. Package size/file packaging/license review is not complete; no file was downloaded. |
| Processing/coverage metadata and lineage validators | Implemented as contracts and validators. No lunar processing pipeline or coverage calculation from real grids exists yet. |
| Map tile delivery and Moon UI | Deferred. No tile server or lunar map layer is operational. |

## Destination model

`src/destinations/types.ts` defines `earth`, `mars`, and `moon`; `src/destinations/registry.ts` describes body geometry, coordinate references, mission-profile identifiers, API namespace, and map configuration. `coordinateReferenceStatus` prevents a provisional or unresolved reference from being mistaken for a verified universal convention. Earth remains WGS 84. Existing Mars profile types remain Mars-only and unchanged. The Moon reference is explicitly provisional, based on the USGS map’s declared Moon sphere and coordinate metadata; product-specific frames remain authoritative.

The current Moon API namespace is reserved as `/api/moon`; this milestone does not register new runtime API routes. Existing `/api/mars-evidence/rems` behavior is untouched.

## Lunar coordinate contract

`src/moon/coordinates.ts` provides pure helpers for longitude direction/domain normalization, geographic coordinates, and a spherical lunar Mercator transform. The transform is not Earth Web Mercator. Its inverse is tested to a stated tolerance of `1e-9` degrees for tested coordinates. Mercator at or too near a pole, invalid latitude/longitude, incomplete coordinate metadata, and unsupported projections throw typed errors. Polar stereographic, source-specific Mercator parameterization, and transformations from projected source files are not implemented; callers must not relabel coordinates to bypass these errors.

The USGS metadata describes Moon target, spherical radius 1,737,400 m, planetocentric latitude, positive-east longitude, longitude range -180 to 180, and Mercator projection. The available metadata inspected here does not establish every source-file projection parameter or selected layer’s internal geometry, so the registry flags the CRS as product metadata and requires later file-level confirmation.

## Scientific product contract and status semantics

`src/moon/products/contracts.ts` defines scientific evidence class, variable semantics, spatial/temporal support, quality/nodata, processing lineage, coverage summary, acquisition status, and lifecycle states. A null means not supplied/verified; it is not zero. `unknown`, `partial`, `unverified`, and state values distinguish incomplete metadata from no product, a failed acquisition, and a source that returned no observations.

`src/moon/registry/dataset-registry.ts` contains the 13 required families. All entries are registered, all report `acquisition: not_acquired`, and none is processed, validated from a downloaded file, or ready for map delivery. Product selection and metadata state are recorded individually. `src/moon/validation/registry.ts` checks unique IDs, required metadata, evidence semantics, coordinate body, bounds/status vocabularies, checksum syntax, lifecycle consistency, coverage, and derived-product lineage.

### Registered families

| Dataset ID | Current product/source note | Spatial support / key boundary |
|---|---|---|
| `moon-lola-global-topography` | PDS `LRO-L-LOLA-4-GDR-V1.0`, release 0015 identified; exact selected grid not acquired. | Global family; release metadata reports 4/16/64 pixels per degree. Valid/interpolated coverage and vertical datum need file-level review. |
| `moon-kaguya-lalt-global-topography` | DARTS `SLN-L-LALT-5-TOPO-GGT-NUM-V2.0`. | Global grid; DARTS describes 16 pixels/degree (~1.9 km). Do not fuse with LOLA without reconciliation. |
| `moon-lro-diviner-thermal` | PDS GCP V1.0 with distinct GCP/PCP products. | GCP global 0.5-degree bins, 0.25-hour local time through 2015-04-01; PCP polar 240 m bins through 2019-02-17. Brightness temperatures are not air temperature. |
| `moon-lroc-wac-imaging` | LROC WAC RDR/global-mosaic family; exact product selection remains open. | Broad/global morphology products exist; ~100 m/pixel nominal instrument scale is not a claim of uniform valid coverage. |
| `moon-lroc-nac-imaging` | LROC NAC EDR/CDR/RDR collections; exact product selection remains open. | Targeted footprints, typically ~0.5–3 m/pixel at mapping geometry; not globally uniform. |
| `moon-chandrayaan1-m3-reflectance` | PDS `CH1-ORB-L-M3-4-L2-REFLECTANCE-V1.0`. | Global and targeted modes; coverage must be measured from footprints. Reflectance is not a direct mineral assay; the archive ground-truth correction was not applied. |
| `moon-clementine-uvvis` | PDS `CLEM1-L-U-5-DIM-UVVIS-V1.0` basemap family. | Global product exists; masks, calibration and per-band coverage unverified. Not cross-calibrated with M³. |
| `moon-lro-illumination` | NASA GSFC PGDA product 69. | Referenced illumination product is south-polar and time-averaged; not a global layer. Model depends on topography and solar geometry. |
| `moon-permanently-shadowed-regions` | No single authoritative product selected. | Polar scope currently registered; requires explicit DEM, horizon, epoch, sampling, projection and threshold. Shadow is not evidence of ice. |
| `moon-lro-lend-hydrogen` | PDS `LRO-L-LEND-4/5-RDR-V1.0`; current release not fixed. | Global orbital context, but effective footprint/resolution and corrections are unverified. Hydrogen indicator is not water-ice detection. |
| `moon-grail-gravity-models` | PDS bundle `grail_gravity_derived` version 1.0. | Global model; effective resolution depends on selected model/degree. Gravity does not uniquely identify shallow structure. |
| `moon-lro-minirf-radar` | PDS LRO Mini-RF global mosaic bundle version 1.0. | Global derived mosaic exists; selected product mode, polarization, incidence and valid coverage must be checked. Radar signatures are not confirmed ice. |
| `moon-usgs-unified-geology` | USGS Unified Geologic Map GIS v2, 1:5M, 2020. | Globally produced interpreted mapping; scale and unit dictionary govern interpretation, not site-scale field truth. |

Registry source links and machine-readable fields are in `src/moon/registry/dataset-registry.ts`. License/redistribution status is `unverified` across the entries until exact source product terms are checked. Known citations are recorded as partial attribution; cite the selected product release in any eventual release.

## Acquisition workflow and storage policy

`scripts/moon/bounded-acquisition.mjs` streams HTTPS response bytes into a uniquely named temporary file, enforces `maxBytes` while streaming, uses bounded retries for transient failures, calculates SHA-256, validates an optional expected checksum, and atomically links the final immutable output without overwriting. Range resume is intentionally not supported. `scripts/moon/acquire-product.mjs` requires a registered dataset ID, an HTTPS URL on that entry’s registered host, explicit output path outside the repository, and explicit byte limit. It writes an external sidecar acquisition manifest. `scripts/moon/acquire-metadata.mjs` is dry-run unless `--confirm-network` is supplied; it is bounded by an explicit byte limit.

Example dry run:

```powershell
npm run moon:acquire:metadata -- --dataset-id moon-usgs-unified-geology --output "$env:TEMP\terramatch-moon\usgs-page.bin" --max-bytes 2000000 --dry-run
```

Metadata fetch (explicit network confirmation):

```powershell
npm run moon:acquire:metadata -- --dataset-id moon-lola-global-topography --output "$env:TEMP\terramatch-moon\lola-profile.html" --max-bytes 2000000 --confirm-network
```

Bounded product file download (only after official file URL/size/format/license review):

```powershell
npm run moon:acquire:baseline -- --dataset-id moon-lola-global-topography --url <official-file-url-on-registered-host> --output "$env:TEMP\terramatch-moon\selected-lola-product.bin" --max-bytes <reviewed-limit> --sha256 <published-sha256> --dry-run
```

Remove `--dry-run` only after confirming the exact official file and reviewed limit. The output and `.manifest.json` remain outside Git. Never bundle raw products into Vercel or store raster pixels in Neon. `data/raw/moon/` is reserved as a namespace but raw acquisitions are expected to remain in an external cache. No delivery path for large map tiles is operational; evaluate range support and tile/CDN architecture before serving raster layers.

## Processing and validation

No product-specific lunar parser, reprojection, resampling, or raster coverage computation has been completed. `DerivedProductLineage` requires input ID/version/checksum, processing-code version, transformations, output units, coordinate reference, nodata policy, generated time, and output checksum. `CoverageSummary` keeps nominal footprint, observed, valid, interpolated and unobserved fractions separate and does not infer them from a family-level “global” label.

Commands:

```powershell
npm run moon:registry:validate
npm run moon:validate
npm run moon:report:coverage
npm run moon:acquire:metadata -- --dataset-id <registry-id> --output <absolute-external-path> --max-bytes <limit> --dry-run
```

`npm test`, `npm run check:web`, and `npm run build:vercel` do not run Moon acquisitions. No new dependency was added.

## Official source references reviewed

- [NASA PDS LOLA GDR dataset](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=LRO-L-LOLA-4-GDR-V1.0) and [release 0015 grid metadata](https://pds.nasa.gov/datasearch/subscription-service/data_product_information.cfm?dsid=LRO-L-LOLA-4-GDR-V1.0&releaseid=0015).
- [JAXA/ISAS DARTS Kaguya terrain FAQ](https://darts.isas.jaxa.jp/missions/kaguya/faq.html) and [LALT global grid product](https://darts.isas.jaxa.jp/datasets/sln-l-lalt-5-topo-ggt-num-v2.0).
- [NASA PDS Diviner GCP/PCP profile](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-DLRE-5-GCP-V1.0).
- [NASA Lunar Surface Data Book](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf) and [LROC PDS release overview](https://www.lroc.im-ldi.com/news/1497?tag=PDS+Release).
- [NASA PDS M³ L2 reflectance profile](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=CH1-ORB-L-M3-4-L2-REFLECTANCE-V1.0); [Clementine UVVIS product documentation](https://pds.nasa.gov/data/clem1-l-u-5-dim-basemap-v1.0/cl_3006/document/volinfo.pdf).
- [NASA GSFC PGDA polar illumination](https://pgda.gsfc.nasa.gov/products/69); [NASA PDS LEND RDR](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LEND-4%2F5-RDR-V1.0).
- [NASA PDS GRAIL gravity bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Agrail_gravity_derived); [NASA PDS Mini-RF global mosaic bundle](https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Alro_minirf_globalmosaic&version=1.0).
- [USGS Unified Geologic Map of the Moon metadata](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/).

## Unverified assumptions and deferred work

- No source dataset binary was downloaded during this implementation. Exact package sizes, individual file formats, nodata values, checksums, and license/redistribution terms therefore remain unverified.
- Product-level release coverage and cell-validity need to be computed from the actual labels/grids; registry family labels are not measured coverage.
- LROC WAC/NAC exact derived-product IDs and footprints need selection before acquisition.
- The Moon application coordinate reference is provisional. The map projection helper implements only a simple sphere-based lunar Mercator; it does not recreate an unverified source map projection or polar transform.
- Global map tiling, storage, browser inspection, and performance remain future work. No Moon map UI, scoring, Earth–Moon analog conclusion, or runtime API endpoint is included.
