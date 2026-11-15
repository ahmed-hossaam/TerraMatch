# M01 — Atlas audit and normalization

## Implemented

- Inspected the workspace: it initially contained only two JSON files and no existing application code, dependency configuration, or tests.
- Identified `أطلس المواقع المشابهة للمريخ (JSON).json` as the atlas (`sites`, declared `site_count: 26`) and `Mars_Analogues_Haneen_Ayman.json` as the research document. The research JSON includes the requested four analog environments and geological mechanisms, astrobiological discussion, and Earth-Mars limitations. It is contextual material and is not converted into measurements.
- Added typed normalized records and Zod runtime validation, atlas normalization, three fixture records, coordinate/duplicate validation, and an audit pipeline.
- The pipeline writes `data/processed/known-sites.json`, `data/processed/candidate-points.json`, `data/processed/atlas-audit.json`, and `data/benchmarks/benchmark-sites.json`. The original atlas is read-only to the pipeline.
- The benchmark manifest holds reference labels separately and is marked `not_run`; no blind benchmark result is claimed.

## Audit findings from the supplied atlas

- Total and declared site count: 26.
- Valid normalized records: 26; invalid records: 0.
- Duplicate IDs: none.
- Missing or out-of-range coordinates: none.
- Approximate coordinates: 24.
- Missing climate fields: none among the nine audited legacy fields (`t_mean_C`, `diurnal_range_C`, monthly maximum/minimum temperature, annual precipitation, humidity, solar radiation, UV index, wind).
- Missing geology fields: none among formation, rocks, and mineral list.
- The supplied atlas has no formal lithology classification field; all 26 normalized formal lithology values remain missing. Rock descriptions are preserved separately.
- The atlas explicitly warns that some mineral descriptions for Egyptian and Gobi sites are inferred partly from general rock composition. Affected records flagged: GKC, GKB, WDE, KHA, GOB. These are not treated as point-specific verified mineral evidence.
- Rainfall discrepancy flagged: ATA records 7.3 mm/year and the atlas notes this exceeds a field measurement of less than 2 mm/year.
- Records requiring manual review include all 24 approximate-coordinate sites, those five sites with inferred mineral descriptions, and ATA for its rainfall discrepancy. These are source-based review flags, not external scientific findings.

## Files added

- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`
- `src/types/location.ts`, `src/schemas/location.ts`
- `src/normalization/atlas.ts`, `src/normalization/fixtures.ts`
- `src/validation/records.ts`
- `scripts/audit-atlas.ts`, `scripts/build-prototype.ts`, `scripts/validate-data.ts`
- `tests/atlas.test.ts`
- `README.md`
- Generated processed files and benchmark manifest listed above.

## Commands

```sh
npm install
npm test
npm run audit:atlas
npm run validate:data
npm run build:prototype
```

## Testing and verification

The audit reports source structural count, IDs, coordinates, missing fields, normalization validity, and manual-review flags. Unit tests cover parsing count, normalized schema validation, duplicate IDs, coordinate bounds, null preservation, mineral/lithology separation, fixture labels, and the climate-only score warning. `npm test` passed (TypeScript compilation and 6 Node built-in unit tests). `npm run audit:atlas` completed, and `npm run validate:data` passed for 26 known records and 3 fixtures. An initial `npm install` could not reach `registry.npmjs.org` in this restricted environment; no packages were needed at runtime, and the installed global TypeScript compiler was used. On a machine without global TypeScript, `npm install` will fetch the declared compiler dev dependency when registry access is available.

## Limitations and missing work

- No source document provides an independently verified climate observation period, so normalized climate values are labeled `legacy_value` with unknown period and coverage.
- Minerals are carried as atlas descriptions, not verified mineral detections. General rock/lithology descriptions are not used to infer mineral evidence.
- The original atlas has incomplete scientific support in places; audit review flags do not resolve those claims.
- No live data source is called; no NASA POWER, Copernicus, or GLiM data is represented as retrieved.
- The current `build:prototype` command is the M01 pipeline only.

## Next step

Global Offers evaluation is complete at `docs/data-sources/global-offers-evaluation.md`. Proceed to NASA POWER as M02 after user review of this completed milestone. Keep Copernicus DEM and GLiM in their original later milestone order.
