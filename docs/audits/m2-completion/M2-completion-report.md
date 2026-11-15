# M2 Completion Report — Focused Scientific Data Acquisition

**Acquisition date:** 2026-11-15  
**Scope:** Targeted searches for four priority references against USGS TADP/ScienceBase, PAAD, EarthChem/PetDB, and GEOROC, plus a directly relevant official USGS Meteor Crater report.

## Outcome

The acquisition added **199 normalized source observations** from two sources: **195 tabulated observations** (15 mount-average columns by 13 rows: 12 oxides and the reported analytical Total) from USGS Open-File Report 2024-1062 Table 1, and **4 GEOROC FeOt rows** for sample label SDV-1. The USGS report describes analysis of Meteor Crater impact-melt materials and its abstract/methods identify drill-hole material collected in the ejecta blanket. The available report table does not give mount-level coordinates; those data are not presented as samples at the M1 atlas point. [USGS report and data-release description](https://pubs.usgs.gov/publication/ofr20241062)

GEOROC returned four electron-probe FeOt (wt%) analyses with mineral/component labels and an original paper citation. Its row location is ETNA/SICILY, with bounds 37–38.5 N and 14–16 E; the sample has no exact coordinate or GEOROC unique ID in the retrieved export. The query bounding box is not itself the sample coordinate. These are preserved as **regional context**, not point evidence or site-wide composition. GEOROC’s own terms require CC BY-SA attribution and critical review of source data and metadata. [GEOROC citation rules](https://georoc.eu/georoc/cite.asp), [data disclaimer](https://georoc.eu/georoc/disclaimer.asp)

### Counts

- Downloaded source payloads: 3 files (USGS full-report HTML, GEOROC CSV, and the GEOROC result-page HTML wrapper). The two scientific payloads are the report and CSV; the wrapper is retained as retrieval context.
- Extracted source observations: 199 (195 USGS report-table observations and 4 GEOROC analytic rows).
- Normalized supplemental evidence records: 199.
- Reference IDs with associated supplemental records: 2 (`MET`, `ETN`).
- Defensible exact/nearby sample-coordinate associations: 0.
- Named-site/study-area association: 1 (`MET`, with no mount coordinates and no point eligibility).
- Regional contextual association: 1 (`ETN`).
- New evidence assigned to M3 point factor comparisons: 0. The ETN mineral factor reports `not_representative`; the USGS glass compositions are retained outside the existing 19-factor set.
- New source records for WHS or RTI: 0.

The GEOROC original citation is Bryce and DePaolo (2004), “Pb isotopic heterogeneity in basaltic phenocrysts,” DOI [10.1016/j.gca.2004.01.016](https://doi.org/10.1016/j.gca.2004.01.016). Row measurements are the values present in the CSV, retained in source fields with wt% units and EMP (EPMA) method. No value is inferred from the paper title or query snippet.

The USGS report is Gullikson, Gaither, and Hagerty, Open-File Report 2024-1062, published April 14, 2025, DOI [10.3133/ofr20241062](https://doi.org/10.3133/ofr20241062); its associated data release DOI [10.5066/P9OGAJ8P](https://doi.org/10.5066/P9OGAJ8P) was not downloaded. The normalized `Total` observations are source-reported analytical totals and are marked `derived_value`, not treated as independent oxide analytes.

## Integration and preservation

Raw retrievals are preserved separately under `data/evidence/m2/raw/`. The deterministic normalization script emits `data/evidence/m2/normalized/site-acquisitions-v1.json`. `scripts/build-m2-m3-evidence.mjs` includes these as supplemental rows in the unified M3 registry and regenerates the 31 × 19 factor coverage plus all-site/source matrices. Existing factor meanings remain unchanged; no ranking, confidence, similarity, or scientific suitability score was added. M1 decisions and eligibility remain authoritative. All 31 references, 3 fixtures and 19 factors remain present.

Historical discovery and comparison artifacts were not rebuilt. Validators were directed to fresh reports in this directory so prior validation report files were preserved. The evidence build does regenerate current derived evidence registry and M2/M3 coverage outputs as the requested pipeline outputs.

## Access status and caveats

The previous M2 run documented sources and exercised deterministic adapters but saved no external payloads. This follow-up made narrow real requests: ScienceBase denied metadata/catalog access (403), PetDB did not return usable results (unfiltered probe rejected; documented filters 502), while the official USGS publication endpoint and GEOROC query/export path returned source content. GEOROC was queried through its form/export request; no manual or full-database download was needed. Thus the earlier zero count reflected the attempted access paths and absence of ingested payloads, not evidence that those sources contain no relevant data.

ScienceBase catalog and known-item requests for MET/PAAD returned HTTP 403. The exploratory EarthChem coordinate request returned a broad result whose first sample was geographically unrelated, so it was rejected; documented bounding-box requests for MET and RTI returned HTTP 502. These are not empty searches. No broad databases were downloaded. See `source-access-blockers.md` and the per-attempt ledger.

The report table's oxide values characterize glass chemistry, not mineral detections or surface abundance. It does not fill a current M3 factor. GEOROC FeOt rows do not establish a mineral's abundance, site-wide composition, or exact locality. Neither source changes candidate discovery or comparisons.

## Reproduction

```powershell
npm run build:evidence
npm run validate:evidence
```

Full validation results are in `validation-report.md` and the adjacent JSON snapshots. Earlier M2/M3 audit prose describing the initial no-acquisition state is historical and superseded for current acquisition counts by this report.
