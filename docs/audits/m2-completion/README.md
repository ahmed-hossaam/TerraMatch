# M2 Scientific Data Acquisition

This directory records the focused 2026-11-15 acquisition follow-up to M2. It supersedes earlier M2 statements in `docs/audits/m2-m3/` that reported zero acquired records; those documents describe the earlier state and have not been rewritten as if the acquisition had already occurred.

## Result

- **199 source-table observations downloaded and normalized:** 195 from USGS Open-File Report 2024-1062 Table 1 for Meteor Crater, and 4 GEOROC FeOt analytical rows for sample label SDV-1 / Etna-Sicily.
- **2 reference records associated with new evidence:** MET and ETN. MET is tied to a published Meteor Crater study area; mount coordinates are absent. ETN is regional context only; GEOROC supplies broad bounds, not the sample point.
- **0 new point-comparison evidence records.** All 199 supplemental observations are point-ineligible. GEOROC is explicitly `not_representative`; USGS geochemistry is retained as supplemental study-area data without mapping it to an M3 factor.
- No new evidence was added for WHS or RTI. ScienceBase returned access denials and EarthChem requests failed or could not be shown to honor the exploratory filters.

## Files

- `M2-completion-report.md` — summary and acquisition caveats.
- `targeted-site-selection.md` — selection rationale.
- `actual-retrieval-results.csv` and `new-evidence-records.csv` — generated from the retrieval manifest and normalized acquisition records.
- `source-access-blockers.md` — outcomes that are failures, rejected payloads, or uncompleted access.
- `updated-data-lineage.md` — raw-to-normalized-to-registry flow.
- `validation-report.md` plus JSON snapshots — validation outcomes.

Raw payloads are under `data/evidence/m2/raw/`; normalized source-linked measurements are in `data/evidence/m2/normalized/site-acquisitions-v1.json`. Rebuild with `npm run build:evidence`; validate with `npm run validate:evidence`.

This acquisition does not validate all 31 reference sites, verify an overall analog claim, create point samples, or change M1 curation decisions, comparison mathematics, discovery artifacts, or historical comparisons.
