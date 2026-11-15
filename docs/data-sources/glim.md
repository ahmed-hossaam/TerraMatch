# GLiM source note

## Service verified

The integration queries the public ArcGIS FeatureServer layer `GLiM_Niveau_I`, layer ID 1:

`https://services8.arcgis.com/4KhTMTZ1x0f76DSg/ArcGIS/rest/services/GLiM_Niveau_I/FeatureServer/1`

The service and layer metadata were inspected before implementing the query. The parent service description identifies **GLiM v1.1** and says it compiles more than 90 geological maps; its ArcGIS API current version is 12 (a separate software version). The layer is polygon geometry (`esriGeometryPolygon`) in WKID 102100 / latest WKID 3857 (Web Mercator), advertises query capability, JSON/GeoJSON/PBF query formats, `esriSpatialRelIntersects`, and maximum query result count 2,000. It exposes `OBJECTID`, `IDENTITY_`, `Litho`, `xx`, `yy`, `zz`, `xx_Description`, `yy_Description`, and `zz_Description`. The descriptive fields and code fields are strings; `OBJECTID` is an OID. The live layer metadata provides field names/types and copyright text, not a field-by-field definition for `Litho` or `IDENTITY_`; the adapter stores these attributes verbatim without assigning them invented meaning. The University of Hamburg project page currently describes GLiM v1.0, while this specific ArcGIS service identifies itself as v1.1; that source-version distinction is preserved here.

Queries send coordinates longitude-first (`x=longitude`, `y=latitude`) and explicitly declare point geometry and input SR EPSG:4326. The ArcGIS service reprojects the query to the layer's Web Mercator reference; results request EPSG:4326. The complete original query response text is stored per site, including any returned geometry. Multiple intersecting features are all retained and marked ambiguous.

## Classification semantics and map limitations

GLiM is a generalized global lithological map assembled from existing geological maps and regional literature. The University of Hamburg project page reports about 1.2 million polygons and an average map scale of 1:3,750,000. The ArcGIS layer contains the three classification levels: the Hartmann & Moosdorf paper defines `xx` as the broad first level, `yy` as a more detailed rock-type subclass, and `zz` as special information about the mapped unit. The `__` code denotes an unavailable optional subclass in the paper's classification description. The code columns and companion descriptions remain separately preserved; the implementation does not flatten them. The `Litho` string is also kept unchanged rather than assumed to be a combined code.

A point intersection is evidence for the mapped polygon(s) at the supplied coordinate, not proof of the exact named site's local geology. The published average scale and generalized source-map lineage limit point-level interpretation. GLiM lithology is not mineral detection: the pipeline emits an empty mineral evidence list and never infers a mineral from a lithology class. `No Data` and `Water Bodies` are preserved as source classes; no returned feature means unavailable data.

## Attribution, reuse, and limitations

The ArcGIS layer copyright metadata cites Hartmann & Moosdorf (2012) and Moosdorf & Hartmann (2015). The University page directs users to the CCGM source for original GIS data. The inspected ArcGIS layer metadata does not state a separate license; this prototype cites the original dataset and authors, but redistribution terms should be checked with the dataset provider before republishing source polygons or attributes. This service integration retrieves point query results only; it does not download the global polygons.

References:

- [University of Hamburg GLiM project page](https://www.geo.uni-hamburg.de/en/geologie/forschung/aquatische-geochemie/glim.html)
- [Live GLiM ArcGIS layer metadata](https://services8.arcgis.com/4KhTMTZ1x0f76DSg/ArcGIS/rest/services/GLiM_Niveau_I/FeatureServer/1?f=pjson)
- [Hartmann & Moosdorf (2012), GLiM classification and source paper](https://doi.org/10.1029/2012GC004370)
- [PANGAEA GLiM v1.1 gridded dataset record](https://doi.org/10.1594/PANGAEA.788537)

Live point lookups have now succeeded for the five prototype sites; raw and normalized results are summarized in [M04 progress](../progress/M04-glim.md). The service's scale and generalized map lineage remain limitations even when a query returns a polygon.

