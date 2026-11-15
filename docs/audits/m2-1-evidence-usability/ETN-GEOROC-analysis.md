# ETN — GEOROC SDV-1 Analysis

## Rows and measurements

All four acquired CSV rows have sample label `samp. SDV-1`, citation `[7192] BRYCE J. G. (2004)`, location label `ETNA/SICILY`, and an empty GEOROC `UNIQUE_ID`. They share one listed sample label and citation. The rows are four FeOt (reported as `FEOT(WT%)`) analyses, not four samples or four collection locations:

| Component | Listed position | FeOt | Unit | Method |
|---|---|---:|---|---|
| Plagioclase | Core | 0.63 | wt% | EMP (EPMA) |
| Plagioclase | Rim | 0.75 | wt% | EMP (EPMA) |
| Olivine | Phenocryst | 20.6 | wt% | EMP (EPMA) |
| Olivine | Groundmass | 27.58 | wt% | EMP (EPMA) |

These are component/position-specific analytical rows. The source does not identify these as four independent field samples or report a unique sample identifier. The normalized file preserves the source fields so the positions can be inspected without converting them to abundance estimates.

## Location and representativeness

GEOROC reports a geographic query box around the selected reference and the returned rows show bounds of 37–38.5 N and 14–16 E. This is regional Etna/Sicily context, not a sample coordinate: the bounds span a much wider area than the target and provide no sample-specific uncertainty. Normalized latitude/longitude and distinct exact location count therefore remain null. The evidence is marked `not_representative`, `regional_context`, and point-ineligible. It does not establish site-specific mineral detection or Etna-wide geochemistry.

## Source attribution

GEOROC's cited publication is Bryce and DePaolo (2004), “Pb isotopic heterogeneity in basaltic phenocrysts,” *Geochimica et Cosmochimica Acta* 68, 4453–4468, DOI [10.1016/j.gca.2004.01.016](https://doi.org/10.1016/j.gca.2004.01.016). The retrieved GEOROC export must be attributed to GEOROC under CC BY-SA 4.0 and the original citation retained. [GEOROC citation guidance](https://georoc.eu/georoc/cite.asp)
