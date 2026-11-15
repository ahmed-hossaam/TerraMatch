# M2 — Scientific Source Integration Report

> **Status update:** This report captures the earlier M2 investigation state and is superseded for current acquisition counts by [`../m2-completion/M2-completion-report.md`](../m2-completion/M2-completion-report.md). A later focused run downloaded and normalized 195 USGS Meteor Crater Table 1 observations and 4 GEOROC Etna/Sicily rows. These remain supplemental/non-point-comparison evidence; access blockers and prior zero counts below are historical, not current totals.

**Audit date:** 2026-11-15  
**Scope:** Existing 31-reference inventory; USGS TADP/ScienceBase, PAAD, EarthChem, GEOROC.  
**Disposition:** Source investigation and reusable parsing/client code implemented; external site-level retrieval is blocked/incomplete. No new scientific observations were added.

## Source investigation

| Source | What it can provide | Access investigated | M2 outcome |
|---|---|---|---|
| USGS TADP / ScienceBase | Catalogued terrestrial analog datasets; item metadata and attached files; coverage and methods depend on each release. | TADP search portal and ScienceBase REST/JSON documentation. A narrow GET of the PAAD ScienceBase item was attempted. | The request received a Cloudflare browser challenge from this environment. No item body or files were retrieved. The adapter is implemented and its unavailable/error behavior is tested. |
| PAAD | Version 1 describes 45 dune-field sites, bedform types, climate class, sand source/composition, coordinates, average elevation and approximate areal coverage. Useful only where an actual PAAD record is spatially and scientifically matched; it is not a universal desert-site dataset. | USGS release page and DOI metadata inspected; release DOI `10.5066/P9IFVZEX`, CC0 1.0. | No PAAD rows downloaded or matched. Expected ScienceBase metadata request was blocked. |
| EarthChem / PetDB | Sample-level geochemical measurements and metadata can include location, analytical values, units, methods and citations. Sample coordinates vary in precision; only a traceable site-level sample supports a site-specific claim. | Official developer documentation for PetDB v4, query filters, locations, samples and citations. Legacy PetDB notice reports its old service unavailable and points to PetDB 2.0. | No API host/credential or site query was established in this environment; no sample results retrieved. A response parser is implemented and tested. |
| GEOROC | Published igneous/metamorphic rock and mineral analyses, including major/trace elements, isotopes, ages, coordinates, methods and original references. | Official query and citation pages; precompiled datasets and repository downloads inspected. The precompiled rock-type collection contains large files, so no broad download was attempted. | No dataset downloaded or site match asserted. A parser for user-selected CSV exports is implemented and tested; this does not constitute a live API integration. |

## Matching protocol and outcome

`M2-site-source-matching.csv` has one row for each of the 31 reference IDs against each of the four source families (124 rows). It records a source access block or `not_queried`, no source record ID, no source URL, and no spatial match. These are coverage-ledger states, not 124 failed queries. The PAAD ScienceBase item request is the only programmatic request attempted; its response was an access challenge, not an empty dataset. Therefore the exact counts are:

- Site/source queries returning a usable record: **0**.
- New raw source records saved: **0**.
- New normalized source evidence records from these four source families: **0**.
- Site IDs gaining new M2 evidence: **0**.
- Site/source pairs with a verified exact, nearby, or regional match: **0**.

The matching code requires coordinates to associate an imported record. It labels an exact coordinate match (<10 m), nearby match (up to the configured radius), regional/uncertain proximity (up to 100 km), or unmatched. These distance bands are screening relationships only; they do not establish representativeness. Name-only matches are not accepted.

## Adapter and preservation status

`src/data-sources/external-catalogs.ts` implements the ScienceBase item client, configurable EarthChem JSON sample request/parser, bounded GEOROC CSV request/parser (20 MB default cap), coordinate relationship helper, and write-once raw response persistence helper. Failures, malformed payloads, and successful empty responses remain distinct. Parsers retain incoming field names/values rather than converting units or interpreting chemistry. A production ingestion workflow still needs source-specific API endpoint verification, explicit result queries, calling the write-once helper for successful response text, and schema/units review before storing site evidence.

No original atlas, M1 curation file, raw provider response, reference record, mission profile, discovery run, or comparison run was edited. The only M2 data file created is a retrieval-coverage ledger with zero records; it contains no invented source observations.

## Access and licensing caveats

- PAAD release page identifies DOI `10.5066/P9IFVZEX` and CC0 1.0; cite the release and retain its source metadata.
- ScienceBase exposes item JSON/REST; TADP is a discovery portal, not evidence that every named analog has a matching dataset.
- EarthChem terms can vary by collection; follow per-dataset terms and citation metadata. Legacy PetDB outage notices must not be generalized to the separately documented current PetDB 2.0 system.
- GEOROC query compilations are CC BY-SA 4.0 and require attribution to GEOROC and the included original references. Do not redistribute a derivative outside those terms.

## Remaining M2 work

When stable source access is available, test one narrow record query at a time, preserve raw payloads unchanged, validate source IDs/coordinates/units/methods and citations, and only then add normalized evidence. The 31-site matching matrix must be regenerated from actual query outcomes and retain `no_match`, `failed`, and `not_representative` as distinct states. No broad GEOROC compilation should be downloaded for this project.
