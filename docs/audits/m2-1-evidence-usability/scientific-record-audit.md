# Scientific Record Audit — Acquired M2 Evidence

**Reviewed:** 2026-11-15  
**Inputs inspected:** the two scientific raw payloads plus GEOROC result page, retrieval manifest, normalizer/parser, normalized acquisition, unified registry, source terms and USGS report text.

## Counts are not independent samples

The acquisition contains 199 normalized table observations, but only two scientific source collections:

| Source/site | Retrieved rows | Samples represented | Reported numeric observations | Location count/context |
|---|---:|---:|---:|---|
| USGS report / MET | 195 cells (15 mounts × 13 rows) | 15 impact-melt particles with pristine glass; one particle per mount | 180 averaged oxide values plus 15 analytical Total rows. Underlying spot-analysis counts are not stated in Table 1. | Four drill holes are named for the 15-particle subset; no per-mount coordinate mapping is available in Table 1. |
| GEOROC / ETN | 4 CSV analytical rows | One repeated sample label `samp. SDV-1`; source UNIQUE_ID is blank | Four FeOt values across plagioclase core/rim and olivine phenocryst/groundmass positions | One regional location label, `ETNA/SICILY`; distinct exact locations cannot be counted. Broad source bounds are retained, not converted into coordinates. |

The USGS report distinguishes the full set of 42 analyzed mounts from the subset of 15 impact-melt particles that had pristine glass and are shown in Table 1. It describes one impact-melt particle per mount. The 195 extracted table cells therefore do not represent 195 samples. Table 1 values are reported particle-level averages; `Total` is an analytical sum, not an independently measured oxide. The report says the pristine-glass subset came from drill holes 45, 60, 94 and 95, at depths from about 0.5 to 6.4 m. [USGS Open-File Report 2024-1062](https://pubs.usgs.gov/publication/ofr20241062/full)

The GEOROC CSV has four rows with the same sample label and citation, but no GEOROC unique sample ID. Each row is a distinct listed material/component position; the file does not establish four independent field samples. The four FeOt values are 0.63, 0.75, 20.6 and 27.58 wt%. They are electron-probe (EMP/EPMA) analyses. GEOROC labels the location `ETNA/SICILY` and provides bounds 37–38.5 N and 14–16 E. Those bounds are much broader than the query box and do not give the collection point.

## Claim boundaries

- **MET:** supports reported WDS major-oxide composition of pristine impact-melt glass in sampled Meteor Crater ejecta material. It does not locate individual mounts at the atlas marker; infer whole-crater composition; measure minerals, abundance or surface mineralogy; or provide a per-mount geospatial sample.
- **ETN:** supports four source-reported FeOt analyses for component/position rows under the SDV-1 label in the GEOROC compilation. It does not establish exact sample coordinates, Etna-wide composition, mineral abundance, or mineral detection at the TerraMatch marker.
- Neither collection contributes new point-comparison values. The original M3 31 × 19 factor matrix remains separate and unchanged in meaning.

## Provenance and licensing

The raw USGS full report is preserved at `data/evidence/m2/raw/usgs/ofr2024-1062-full.html`. Table 1 links to a USGS ScienceBase data release, DOI [10.5066/P9OGAJ8P](https://doi.org/10.5066/P9OGAJ8P), but that full release was not acquired here. USGS report DOI: [10.3133/ofr20241062](https://doi.org/10.3133/ofr20241062). The report publication page dates the report publication to April 2025, while the series identifier is 2024-1062.

GEOROC CSV and result-page HTML are preserved at `data/evidence/m2/raw/georoc/`. GEOROC's source citation is [Bryce and DePaolo (2004)](https://doi.org/10.1016/j.gca.2004.01.016), citation number 7192. GEOROC's compilation terms specify CC BY-SA 4.0 attribution and require users to cite source material; the UI and project report now state this. [GEOROC citation/usage guidance](https://georoc.eu/georoc/cite.asp)

The raw files were not altered. The existing IDs were not regenerated or renamed. New context annotations clarify the denominator and semantics for every normalized record; all previously stored units, values, IDs and null coordinates are preserved.
