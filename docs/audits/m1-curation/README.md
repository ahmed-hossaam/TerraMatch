# M1 reference curation

## Outcome

M1 adds a versioned, reversible curation overlay for the complete 31-record reference archive. It preserves every stable ID and keeps source records, raw responses, and historical scientific artifacts unchanged. The overlay records coordinate meaning, dimension-level evidence status, limitations, conflicts, external claim citations where reviewed, provider-response presence, a preliminary disposition, and point-comparison eligibility.

Current preliminary counts are derived from `data/curation/reference-curation-v1.json`: 24 `keep_with_limitations`, 4 `region_only`, 3 `exclude_pending_review`, and 0 `keep_verified`. This is not a target count or a conclusion that pending places are scientifically irrelevant. See the generated [site report](site-curation-report.md), [matrix](site-curation-matrix.csv), [coordinate review](coordinate-review.md), and [citation review](citation-review.md).

Of the 11 M0 pending records, six move to `keep_with_limitations` (RAM, MDRS, MET, BON, ETN, HIS), two move to `region_only` (DEV, MDV), and three remain pending (GOB, LAN, SVA). The M1 inclusion policy and the reasons for each are in the manifest and per-site report.

## Method and scope

The M0 audit and current structured records were used as the repository baseline. Targeted literature and institutional-source checks were made for the 11 M0 pending records and selected coordinate conflicts. A source was attached only to the narrow site/dimension it describes. A nearby feature, broad region, mission exercise, or institution does not establish that the atlas point is the sample location. Where that identity or coordinate link is unresolved, the record remains pending or region-only.

Provider states reflect stored artifact existence documented in M0, not independent reproduction in M1. No retrieval scripts were run. NASA POWER is gridded/model-derived, Copernicus GLO-30 evidence is a single DSM pixel, and GLiM is a generalized lithology map. None verifies minerals or geological processes at a point.

## Manifest schema

`data/curation/reference-curation-v1.json` contains a root schema/version, source inventory and inclusion policy, and exactly one overlay record per stable reference ID. Each record contains the required stable ID/display/source name, country or region, location type and coordinate assessment, preliminary decision and rationale, categorical dimension evidence, claim citation metadata, limitations, conflicts, review status, curation version, provider coverage, and point-use flag.

Evidence statuses are categorical, not a combined score. `primary_dataset` means a stored provider artifact supports only its product-specific dimension; `peer_reviewed_source` and `official_documentation` indicate a citation supports the stated narrow claim; `atlas_claim` means inherited from the supplied atlas and not independently verified; `unverified` means no adequate traceable support was established; `conflicting` denotes an unresolved conflict; `derived_value` is reserved for documented calculations. No missing value is converted to zero.

The source display name remains in `originalSourceName` as provenance metadata. English `displayName` and country values are used for the interface. The original Arabic atlas and raw sources remain untouched.

## Reproduction and checks

The manifest generator only writes the overlay. It reads the current reference archive and preserves any manually reviewed citation entries in the existing manifest. The documentation renderer derives the CSV and site report from that manifest.

```powershell
node scripts/build-reference-curation.mjs
node scripts/render-reference-curation-docs.mjs
node --test tests/reference-curation.test.mjs
npm run check:web
npm run build:web
```

## Important caveats

This M1 work is a targeted curation pass, not a complete literature review of every inherited claim or a field validation campaign. Most of the 31 site records therefore retain legacy claims as `atlas_claim`, and all retained point coordinates remain subject to their explicit coordinate assessment. No record is labeled `keep_verified`. The full archive remains available; point-comparison eligibility is separately explicit and reversible.

The current discovery validation report is structurally `valid` but refers to a different run ID than the current latest discovery artifact. The current comparison report matches the comparison artifact, and that comparison references the current discovery run. M1 deliberately did not rewrite historical discovery/comparison artifacts or their reports; this stale discovery report remains an operational follow-up.
