# NASA Space Apps Global Offers — data source evaluation

**Reviewed:** 2026-11-14. This is a documentation and feasibility review only. No account was created, credentials requested, API called, or dataset downloaded. Availability and terms can change; recheck the linked provider documentation before use.

## Microsoft Planetary Computer

### Relevant collections and contribution

| Collection | What it can contribute | Coverage and resolution | Time coverage / cadence |
|---|---|---|---|
| Copernicus DEM GLO-30 / GLO-90 | Cloud hosted access and searchable item metadata for the already planned Copernicus DEM terrain workflow. GLO-30 is about 30 m and GLO-90 about 90 m. Both are digital surface models (DSM), not guaranteed bare-earth terrain. | Near-global; provider catalog calls coverage near-global rather than complete global. | Static elevation product; acquisition/processing vintage must be read from the selected item metadata. |
| Sentinel-2 L2A | Multispectral surface imagery for land/surface context and change/cover screening. Bands are 10–60 m; not direct proof of mineralogy. | Global archive. | 2016–present, approximately five-day revisit as described in the catalog. |
| Landsat Collection 2 Level-2 | Long-term multispectral/thermal surface context for site characterization and change history. | Catalog identifies global coverage; spatial resolution varies by sensor/band. | Landsat record extends to 1982 in many places; scene cadence and coverage vary by sensor and location. |
| ESA WorldCover / Esri 10 m Land Cover | Land-cover classes can support land/ocean screening and contextual surface categories. | Global; 10 m. | ESA WorldCover versions are discrete map years, not daily or continuous observations (catalog currently lists 2020/2021 products); Esri layer listed for 2020. |

The Planetary Computer STAC API supports searches by spatial and temporal extents; public catalog metadata access is anonymous. Raster assets can be cloud-optimized GeoTIFFs accessed with standard geospatial software. Some storage assets require short-lived SAS tokens; tokens can be issued without a registered account. Anonymous downloads may be throttled. Some hosted datasets are documented but not indexed in STAC, so collection-level support must be checked before designing a pipeline. [STAC/catalog overview](https://planetarycomputer.microsoft.com/docs/concepts/data-catalog/), [token and access guidance](https://planetarycomputer.microsoft.com/docs/concepts/sas/), [Copernicus DEM and catalog listing](https://planetarycomputer.microsoft.com/catalog?filter=COG), [Sentinel-2 catalog description](https://planetarycomputer.microsoft.com/catalog?trk=article-ssr-frontend-pulse-x-social-details_comments-action_comment-text)

### Licensing and limitations

The platform describes the hosted data as free to access, but the upstream provider's license controls each dataset. Review the exact collection license and attribution requirements before redistributing derived or raw assets. Tokens, throttling, cloud egress, asset size, and variable STAC indexing make bulk/global downloads inappropriate for this small prototype. HLS is an example of a product that is not currently STAC indexed and has geographically limited coverage; do not infer all catalog holdings share one API or spatial extent. Planetary Computer does not provide a comparable global bedrock lithology/mineral dataset in the reviewed catalog. Imagery may help characterize surface classes, but spectral signals require careful processing and do not establish in-situ mineral composition by themselves.

### Relation to planned sources and recommendation

- **Copernicus DEM:** Do not adopt as a replacement. It hosts the same Copernicus DEM product, so it may simplify STAC discovery and cloud-windowed reads, but does not make the underlying elevation evidence scientifically better. Compare access reliability and licenses during M03.
- **GLiM:** Does not replace the geological map or provide precise mineralogy. Global imagery/land cover can add context, not equivalent lithology evidence.
- **Recommendation: Test later.** Consider a small STAC search and one-site raster-window read during M03, only if it makes the existing Copernicus workflow easier and the chosen assets' license/coverage fit.

## Meteomatics

### Relevant variables and coverage

The Weather API documents temperature (including interval mean/min/max), relative humidity, precipitation, wind speed/direction/gusts, radiation, pressure, and other meteorological variables. Requests use time, parameter, location, and output format; the service describes historical, current, and forecast data globally. Global coverage does not mean every source/variable has uniform quality or resolution: the provider's “Mix” chooses among sources, and resolution depends on the selected model, parameter, place, and time. The documented general Mix can reach fine spatial/temporal resolutions in some cases, while global model products are coarser; model-specific metadata should be inspected for any candidate use. Historical weather product pages advertise model and station-derived historical data from 1940 onward. [Weather API getting started](https://www.meteomatics.com/en/api/getting-started/), [parameters](https://www.meteomatics.com/en/api/available-parameters/), [models and source resolutions](https://www.meteomatics.com/en/api/request/optional-parameters/data-source/), [historical weather description](https://www.meteomatics.com/en/weather-data/)

### Access, pricing, and licensing

Production API access requires an account username and password and uses HTTP Basic Authentication over HTTPS. Credentials must be stored outside source control. The current package comparison lists historical access of 24 hours for Core, 2 years for Pro, and since 1940 for Premium; confirm the exact offer/contract before relying on a period. Pricing is quote/package-based rather than a clearly stated public per-request price. A provider document advertises a 14-day trial with 1,000 API queries and limits per minute/concurrent requests; this may be offer-specific and should be confirmed with the current signup terms. Individual requests also have documented parameter/location limits. Service terms restrict reuse, redistribution, publication, and modification unless the contract explicitly permits it; this is a material issue for an open research dataset or public-facing application. [pricing and historical-access tiers](https://www.meteomatics.com/en/pricing/), [API request limits](https://www.meteomatics.com/en/api/appendix/), [trial information](https://www.meteomatics.com/files/Papers/Weather-Data-for-Energy-Security-and-Planning.pdf), [license terms](https://www.meteomatics.com/en/gtc-meteomatics-ag/)

### Comparison with NASA POWER and recommendation

Meteomatics may offer a meaningful later advantage if the project needs earlier historical model data, station observations, specified model selection, or finer resolution at selected places and has a funded/authorized license. Its “Mix” is a convenience blend rather than one uniform observational climate record, so reproducibility requires recording the chosen source/model, parameters, time, and contract details. The reviewed public material does not establish that it is scientifically superior to NASA POWER for consistent global historical comparison. NASA POWER remains the planned initial source because it is the priority baseline and does not require embedding a commercial credential into this prototype.

- **Recommendation: Not needed for M02; test later only if a documented resolution or historical-period gap remains.** Do not replace NASA POWER based on marketing claims. First compare a small overlap sample against a fixed NASA POWER period, model/source metadata, units, missingness, and license/publication permission. No Meteomatics account, key, or paid service was used in this evaluation.

## Decision summary

| Service | Recommendation | Reason |
|---|---|---|
| Microsoft Planetary Computer | **Test later** | Useful STAC discovery and cloud-hosted access to Copernicus DEM, satellite imagery, and land cover; not a stronger replacement for Copernicus DEM or GLiM. |
| Meteomatics | **Not needed now; possible later comparison** | Could fill a verified climate-resolution/archive need, but gated by credentials, tier/price, and restrictive reuse terms; no demonstrated advantage over NASA POWER for this prototype. |

## Verification boundary

This evaluation used provider documentation and catalog pages only. It did not verify live API response behavior, collection availability by each atlas point, exact per-item licenses, trial eligibility, or contractual redistribution rights. Those must be confirmed before integration or public release.
