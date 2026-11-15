# Scientific limitations

## Inventory and curation

The 31 references are an evidence archive, not 31 validated Mars analogs. The current curation contains no `keep_verified` record: 24 records are retained with limitations, 4 are region-only, and 3 are excluded from point comparison pending review. Exclusion means not currently eligible for point comparison; it does not establish that a location is scientifically irrelevant.

## Evidence character

- NASA POWER climate is gridded/model-derived data at requested coordinates, not local weather-station observations. Period, units, provider and valid observation metadata must be compatible before comparison.
- Copernicus GLO-30 is a digital surface model. A single pixel is not mean elevation, terrain variability, slope, roughness or mobility characterization.
- GLiM is a generalized lithology map, not field verification and not mineral detection. Ambiguous intersections and no-data classes are not converted into a single class.
- MET supplemental chemistry contains 195 table-level records, including 15 particle/mount contexts with unavailable mount coordinates; the entries are not 195 independent locations and are excluded from point-comparison factors.
- ETN GEOROC evidence contains four analyses for one sample label in broad regional context. Its coordinate bounds do not support a representative point association or site-specific mineral detection.
- Geological-process claims inherited from regional descriptions are not newly retrieved, site-specific process evidence. Missing, failed, unavailable, unverified, conflicting and non-representative states must remain distinct.

## Discovery and comparison interpretation

The stored bounded discovery run has four grid cells, three evaluated candidates with insufficient required evidence, and one conservative reference-mask rejection. NASA POWER and GLiM succeeded for the evaluated cells in that archived run; Copernicus terrain retrieval failed. Grid-cell centers are approximate screening coordinates, not field-site locations.

The current comparison has 96 pairs and 1,824 factor rows: 232 compared, 1,520 unavailable and 72 failed. Compared climate quantiles/means are descriptive; GLiM exact-code matches are map-class comparisons; elevation is only a compatible DSM pixel difference. No overall score, ranking, confidence, suitability result or analog confirmation is calculated.

## Demonstration boundary

TerraMatch can demonstrate a traceable reference archive, M1 curation display, explicit evidence states, bounded grid screening, provider outcomes and factor-level candidate/reference comparison. It cannot establish that a candidate is a Mars analog, predict mission performance, infer mineral presence from lithology, or replace expert field and planetary-science review.
