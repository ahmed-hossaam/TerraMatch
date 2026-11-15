# English-language audit

The frontend uses English labels, route names, site display names, and curated country labels. The curation overlay keeps the original source-language site name only in `originalSourceName`; the API's display sanitizer does not expose that field as the primary site name. The application uses English `displayName` values derived from the existing English normalized region names.

## Repository search and classification

A recursive Arabic Unicode scan was run over the repository, excluding dependencies, build output, and Git internals. M1-authored Markdown and frontend UI contain no Arabic. The following retained occurrences were classified:

- **Immutable original source:** `أطلس المواقع المشابهة للمريخ (JSON).json` and `Mars_Analogues_Haneen_Ayman.json` contain original Arabic names/content and were not edited.
- **Preserved normalized/source-derived data:** Arabic source names occur in `data/processed/known-sites.json`, `data/processed/reference-sites.json`, `data/processed/atlas-audit.json`, and `data/benchmarks/benchmark-sites.json`. The curation manifest also carries each available atlas name in `originalSourceName` only as source metadata. These files were not translated or rewritten.
- **Historical generated outputs:** Arabic remains in the 15 archived comparison JSON files under `data/processed/comparison-runs/`, including `latest.json`; these outputs were intentionally not edited. Existing M0 audit documents quote source names and excerpts and remain unchanged.
- **Historical documentation / source paths:** Arabic occurs in `README.md` as the original atlas filename, `docs/progress/M01-atlas-audit.md`, and `docs/reports/TERRAMATCH-CURRENT-STATUS.md`. These pre-existing documents were not rewritten as part of the curation task.
- **Application/developer source matching:** `scripts/app-api.mjs` contains Arabic country-name keys that map original source values to English country labels. `src/normalization/atlas.ts` and `scripts/audit-atlas.ts` compare original Arabic country values; the audit script also names the immutable Arabic atlas path. `tests/atlas.test.ts` has source-language test fixtures. These literals are source matching/fixture data, not rendered content. A future code-only cleanup can replace country matching with stable IDs after confirming atlas audit equivalence.
- **Raw external/provider data:** the scan found no Arabic Unicode in `data/raw/`; no raw provider payload was modified.

The application API sanitizes source-language values from reference display responses; the M1 API integration test confirms that list/detail responses contain no Arabic Unicode. The original source name remains available in the curation JSON for provenance but is omitted from the user-facing API response.

M1 did not claim repository-wide Arabic removal. The normalized interface names and all newly authored M1 documentation are English. The original Arabic source names remain available as provenance metadata, not primary display labels.
