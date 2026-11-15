# Updated M2 Data Lineage

```mermaid
flowchart LR
  USGS[USGS OFR 2024-1062 full report] --> RawUSGS[data/evidence/m2/raw/usgs/ofr2024-1062-full.html]
  GEOROC[GEOROC geographic form and CSV download] --> RawCSV[data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.csv]
  GEOROC --> RawPage[data/evidence/m2/raw/georoc/ETN-SDV-1-FEOT.txt]
  Manifest[data/evidence/m2/retrieval-manifest-v1.json] --> Normalize[scripts/normalize-m2-acquired-evidence.ts]
  RawUSGS --> Normalize
  RawCSV --> Normalize
  Normalize --> Acq[data/evidence/m2/normalized/site-acquisitions-v1.json]
  Acq --> Build[scripts/build-m2-m3-evidence.mjs]
  Curation[data/curation/reference-curation-v1.json] --> Build
  Factors[data/profiles and processed reference/provider evidence] --> Build
  Build --> Unified[data/evidence/evidence-registry-v1.json]
  Build --> Coverage[data/evidence/evidence-coverage-v1.json]
  Unified --> API[GET /api/references/:id/evidence]
  Coverage --> API2[GET /api/evidence/coverage]
  API --> UI[Reference evidence detail UI]
```

The raw HTML and CSV are preserved as separate downloaded payloads. Normalization extracts report-table rows and preserves GEOROC raw row fields, units, broad coordinate bounds, source IDs (or explicitly absent source unique IDs), sample labels, methods, source citation, and limitations. The GEOROC result page is also retained as retrieval context. No raw response is rewritten by the builder.

There are 199 supplemental rows: 195 for MET and 4 for ETN. The MET rows point to the study area by report/site identity, but carry null sample coordinates and `pointComparisonEligible:false`; their values are not mapped into a current comparison factor. The ETN rows retain null point coordinates, broad source bounds, `spatialRelationship:regional_context`, and state `not_representative`. They attach to the existing mineral-evidence factor only as regional context; factor value remains null for point comparison.

The unified registry adds these rows under `supplementalRecords`; its 589 existing reference-factor rows (31 × 19) remain. The builder also regenerates the 155-row acquisition site/source matrix (31 references × five source routes) and the M2 source coverage summary. The 3 test fixtures remain in the separate fixture file and are not added to reference evidence.
