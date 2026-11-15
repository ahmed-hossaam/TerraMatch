# M2 + M3 audit package

This milestone adds a traceable unified evidence layer and point-eligibility enforcement while preserving the reference archive and historical scientific outputs.

## Status

- **M2: targeted acquisition completed, with narrow coverage.** The follow-up in [`../m2-completion/README.md`](../m2-completion/README.md) supersedes the initial zero-retrieval status below. 199 source observations were normalized from a USGS Meteor Crater report and GEOROC Etna rows; only MET and ETN gained supplemental records. There are still zero new point-comparison records. ScienceBase/PAAD returned HTTP 403, EarthChem returned HTTP 502 for documented filters (and one unfiltered response was rejected), and the GEOROC data remains regional.
- **M3: implemented for current stored evidence.** Added a versioned 31 × 19 factor evidence registry and reproducible coverage report; API and reference detail expose evidence provenance/limitations; new discovery masks and comparison runs honor M1 eligibility. No similarity, ranking, suitability, or confidence score exists.

## Outputs

- `M2-source-integration-report.md` — source access, actual retrieval counts, blockers.
- `M2-source-coverage-matrix.csv` — source coverage by reviewed site inventory.
- `M2-site-source-matching.csv` — 31 × 4 source/site ledger.
- `M2-data-lineage.md` — source-to-application lineage.
- `source-registry.md` — official source access, rights, and limits.
- `M3-evidence-system-report.md` — model, factors, curation gate, API/UI.
- `M3-evidence-coverage-matrix.csv` — all site/factor states and limitations.
- `M3-validation-report.md` — current validator evidence.
- `english-language-audit.md` — remaining Arabic source metadata classification.
- See `../m2-completion/` for current focused M2 retrieval results, blockers, raw/normalized lineage and validation snapshots.

## Reproduction

```powershell
npm run build:evidence
npm run validate:evidence
npm test
npm run check:web
npm run build:web
```

The evidence build writes only the versioned evidence registry/coverage and M2 source coverage artifacts. It does not rewrite the atlas, raw provider data, curation manifest, reference records, mission profiles, or historical discovery/comparison runs. Check `git status` before staging any outputs.
