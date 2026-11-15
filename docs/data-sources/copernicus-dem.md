# Copernicus DEM source note

## Selected source and access

The prototype targets the public AWS Open Data copy of Copernicus DEM GLO-30, using its Cloud Optimized GeoTIFF assets through HTTP range requests with the Node.js `geotiff` library. It does not download a global mosaic. Tile IDs and object paths follow the publisher's one-degree tile naming convention; the TypeScript adapter computes the expected tile and verifies CRS, georeferencing, dimensions, and sample pixel bounds.

The selected public product is `COP-DEM_GLO-30-Public`, documented as the Copernicus DEM 2021 release. The registry describes GLO-30 COGs and notes that some tiles may be withheld. Access to the public AWS objects does not require an API key in the intended workflow. The current extractor is Node.js/TypeScript using `geotiff` remote COG range reads; it does not depend on GDAL. Actual network accessibility depends on the runtime's outbound HTTPS and HTTP range support.

## Data meaning and spatial reference

GLO-30 is a nominal 30 m **Digital Surface Model** (DSM), not guaranteed bare-earth elevation. It may represent vegetation and buildings. The source is a geographic raster in WGS84 (EPSG:4326), with vertical heights in meters relative to EGM2008 (EPSG:3855 vertical reference). Its grid is nominally one arc-second in latitude; ground spacing in longitude varies with latitude. A single point sample is an elevation pixel, not a site-wide distribution.

The product handbook reports global vertical accuracy below 4 m at 90% linear error, with relative accuracy dependent on slope; these product-level figures do not guarantee local accuracy. The handbook also states coverage limitations, including Greenland and Antarctica. Coordinates in the atlas are often approximate, so even a technically valid sample may not land at the actual named feature.

This integration extracts elevation only. Elevation is not slope, roughness, or a terrain suitability measure. No terrain metric or similarity score is computed.

## Licensing, attribution, and limitations

The AWS registry identifies the dataset as public and under Copernicus data terms/general license. Retain attribution to the European Union/Copernicus programme and the named product/version when redistributing derived data; check the linked terms for current attribution wording and any reuse context. Public availability is not a statement that every asset is present or that service availability is guaranteed.

References:

- [Copernicus DEM product description](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)
- [AWS Open Data dataset listing](https://registry.opendata.aws/copernicus-dem/)
- [AWS product readme and object layout](https://copernicus-dem-30m.s3.amazonaws.com/readme.html)
- [Copernicus Data Space product documentation](https://documentation.dataspace.copernicus.eu/Data/Others/CCM.html?q=COP-DEM_GLO-30-DGED)
- [Copernicus DEM product handbook (PDF)](https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf)

The extraction path is Node.js/TypeScript; Python is not required. `geotiff` 3.0.5 reads a one-pixel raster window from the remote COG using HTTP ranges. The five prototype site COGs were opened and sampled successfully. Raw per-site JSON samples and normalized provenance remain separate. See the actual sample table and validation status in [M03 progress](../progress/M03-copernicus-dem.md).
