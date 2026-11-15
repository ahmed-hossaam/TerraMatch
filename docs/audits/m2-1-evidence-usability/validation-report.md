# M2.1 Validation Report

## Checks added

- Each normalized supplemental record must carry explicit source-row/sample/measurement/location context and count basis.
- USGS records are constrained to MET; null coordinates; no M3 factor association; no point eligibility; 15 represented particles, 180 reported average oxide entries, four source-named drill holes; totals classified separately as reported analytical sums.
- GEOROC records are constrained to ETN; four FEOT rows, one shared sample label, one sample label count, unknown exact distinct-location count, null point coordinates, regional/non-representative state, and no point eligibility.
- The UI/application tests check the 15-particle / 195-entry distinction, one GEOROC sample label / four rows distinction, English labels, and attribution.
- The MET context keeps the underlying spot-analysis count null while recording 180 published average oxide values separately; the 15 reported Total rows (one per particle mount) are not counted as independent analytes. Four named drill-hole contexts are not converted to mount coordinates.
- Existing inventory checks confirm 31 references, 19 factors, and 3 separate fixtures. SHA-256 assertions preserve the pre-M2.1 latest discovery and comparison artifacts.

## Verification commands

Commands executed after implementation:

```powershell
npm test
npm run check:web
npm run build:web
npm run build:evidence
npm run validate:evidence
npm run validate:data
```

Results: **78 automated tests passed**, frontend type check passed, production web build passed with the existing large MapLibre/React Three Fiber chunk warning, evidence build and validation passed (31 references, 3 fixtures, 19 factors, 589 factor rows, 199 supplemental rows), and data validation passed (26 known-site source records and 3 fixtures). The 9 focused catalog/M2.1 tests passed in a separate targeted run.

`build:evidence` regenerates derived evidence and audit ledgers; it does not regenerate discovery/comparison history. Hash-guarded tests confirmed the latest historical discovery and comparison JSON remained unchanged, as did all three acquired raw source files. No provider retrieval was performed for M2.1.
