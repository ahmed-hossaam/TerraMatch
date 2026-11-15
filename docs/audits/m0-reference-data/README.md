# M0 — Scientific Reference Data Audit

**Audit date:** 2026-11-15  
**Scope:** Read-only audit of the repository’s 31 currently combined reference records, their upstream atlas/review material, provider artifacts, and application data flow.  
**Decision status:** Preliminary audit disposition; this document does not change the reference inventory or certify field truth.

## Executive summary

TerraMatch is a Mars-first Earth analog evidence-triage application. Its current authoritative runtime inventory contains 31 records: 26 normalized entries from the supplied atlas and five reviewed supplements. That count is a property of the current files, not a target this audit assumes should be retained.

The normalized legacy records preserve extensive atlas-derived climate and geology narratives, but most values have no traceable observation period or site-specific source in the record. The original atlas itself flags 24 of its 26 coordinates as approximate, notes that some mineral descriptions for Egyptian and Gobi sites are inferred from general rock composition, and records an Atacama rainfall discrepancy. Several individual atlas citations resolve to secondary or general pages rather than evidence for the exact location/claim. The JSON schema validation report is `valid`; that is structural validation, not scientific verification.

The supplemental review is more explicit about location granularity and uncertainty. Dallol, Dalangtan, and Gypsum Hill have approximate point/cluster coordinates and 9/9 stored supplement provider responses. Semail and Dasht-e Lut are correctly region-only with null coordinates. The existing runtime policy should continue to expose all five with limitations until any later curatorial decision; this audit does not remove them.

### Preliminary disposition

| Decision | Count | Records |
|---|---:|---|
| `keep_verified` | 0 | None assigned: no exact location/claim pairing was sufficiently established here to warrant an unqualified verified label. |
| `keep_with_limitations` | 18 | GKC, GKB, WDE, KHA, ATA, MOJ, DHO, PIL, WHS, RTI, LON, SAL, HMP, KIL, LAM, DALL, DAL, AHS-GH |
| `region_only` | 2 | SEM, LUT |
| `exclude_pending_review` | 11 | DEV, RAM, MDRS, GOB, MET, BON, MDV, LAN, HIS, ETN, SVA |

`exclude_pending_review` is a recommendation for future authoritative eligibility review based on the current record’s weak or insufficient claim-level traceability; the records remain intact in the current 31-record dataset. It does not mean the named places are scientifically uninteresting or that their analog relevance is disproven. See [site-by-site audit](site-by-site-audit.md) for record-level reasons.

## Scope and method

1. Read the original atlas and research-context JSON, normalized 26-record dataset, supplementary review and five-site input, combined reference artifact, benchmark fixtures, validation report, retrieval reports, raw response files, normalized provider products, scripts, API and UI data consumers.
2. Compared IDs, record types, coordinates, flags, evidence fields, provenance links, provider raw files, and reports. Kept missing values distinct from zero and from retrieval failure.
3. Used source URLs recorded in the repository and selected official/provider and peer-reviewed source documentation to characterize the data products. The audit did not independently re-investigate every atlas citation or establish field conditions at all 31 places. Claims not individually traceable to a source and location are labeled atlas-derived or unverified.
4. Assigned one preliminary disposition per current reference using the requested four-category framework. Decisions are conservative and concern current record eligibility, not a combined suitability score.
5. Did not run retrievals, rebuild datasets, or run validators that write reports. Existing validation evidence is reported as found on disk; read-only consistency checks are described in the conversation summary.

### Categorical evidence quality rubric

These are separate, non-combined dimensions; no numeric or overall analog-suitability score is calculated.

| Category | Criterion |
|---|---|
| `strong` | A traceable primary/official source or stored raw+normalized provider artifact supports the exact dimension and compatible site/sample location; source identity, period/product and units are present. This still does not imply the location represents a whole region. |
| `limited` | A credible source or provider response exists, but the site point is approximate, spatial support is coarse/generalized, scope is local/cluster/region, or some provenance metadata is incomplete. |
| `weak` | Only an atlas narrative, secondary/general citation, unperiodized legacy number, unsupported inference, or unresolved identity/location mapping is available. |
| `conflicting` | Two documented sources or measurements disagree on the same claim and scope; preserve both and do not choose silently. |
| `not_assessed` | The audit did not have enough source material to decide; do not interpret as absent or false. |
| `missing` | No evidence value is present in the audited record/artifacts. This means missing evidence, never zero or absence of the phenomenon. |

Dimension-specific reading: identity reliability concerns whether the named feature/site is unambiguously tied to the record; coordinate reliability concerns source, type and uncertainty; provenance quality concerns traceable claim-level citations and raw data; climate coverage concerns parameter/period completeness (not representativeness); terrain coverage distinguishes one pixel from a spatial summary; lithology coverage means a mapped category with stated scale; mineralogy coverage requires sample-linked mineral evidence (GLiM does not count); geological-process coverage requires a traceable process observation/publication at the relevant site scale; Mars-analog relevance requires an explicit, sourced analogy for a defined dimension. A value can be strong for one dimension and weak/missing for another.

## Key findings

- `data/processed/reference-sites.json` is the current combined runtime inventory and contains 31 unique IDs. `data/processed/known-sites.json` contains the original 26 only; `data/processed/supplementary-known-sites.json` contains the additional five. The three `test_fixture` candidates are separate in `data/processed/candidate-points.json`.
- The supplied `Mars_Analogues_Haneen_Ayman.json` is a research-context document with sections and references, not the structured 26-site measurement table. The separate Arabic atlas JSON is the structured source for the legacy records.
- Provider raw/report artifacts establish current point provider coverage for 8 records: original five GKC, GKB, WDE, KHA, RTI plus DALL, DAL, AHS-GH. NASA POWER, Copernicus GLO-30, and GLiM each have 8 corresponding site responses. The stored normalized and raw evidence is still product evidence at approximate coordinates, not ground truth at an entire named region.
- Site sampling is sparse: 23 of 31 reference records have no stored point response for any of these three integrations. The two region-level sites are deliberately not submitted for point retrieval.
- `data/processed/reference-sites-validation-report.json` says `valid`, 26 original + 5 accepted supplements = 31, 3 point-retrieval-eligible supplement records, 2 region-level, 9/9 supplementary attempts successful, and 3 fixture records separate. This report was generated 2026-11-14T22:35:40Z. Its validity does not resolve the scientific limitations in this audit.
- The combined dataset repeats supplement records also present in `supplementary-known-sites.json` by design; the IDs are not duplicated within the authoritative combined inventory. Reports are generated snapshots and can be stale relative to inputs; no report was rewritten during this audit.
- Legacy values are labeled `legacy_value` but are still rendered as numeric climate/elevation fields in parts of the application. A user can mistake a copied atlas number for a measured or newly retrieved value unless the interface emphasizes provenance and time period.

## Important caveats

- This is not a field campaign, expert panel review, or systematic literature review. `keep_verified` is intentionally empty; lack of that label does not imply the locations are false.
- Citation presence in JSON does not prove the cited page supports every claim. Citations can be broad, secondary, stale, inaccessible, or unrelated to the exact coordinate.
- The original normalized provenance generally stores an atlas source URL but not a publication title, publisher, publication date, retrieval date, page/table, or a claim-to-citation mapping. Those absent metadata are not guessed. Supplement review entries have more bibliographic labels, but are not a substitute for expert claim review. The source registry provides verified product/source metadata where available; individual legacy URLs remain visible in each site section.
- “Coordinates available” is not the same as a defensible point location. A rounded coordinate may be a centroid, named area, field campaign region, or site marker. Coordinate uncertainty is generally not quantified.
- NASA POWER daily values are gridded/model-derived environmental products (data are parameter-specific source grids), not in-situ station observations at the coordinate. Copernicus GLO-30 is a digital surface model and current samples are single pixels. GLiM is a generalized lithological map and cannot establish sample mineralogy or geological process.
- The current provider response files and structural validators were audited as repository artifacts. This report does not independently query the providers or verify current remote availability.
- The audit did not modify any existing scientific data or run a command that regenerates it.

## Recommended next steps

1. Keep the existing 31 records intact while publishing a versioned curation decision layer and making the four dispositions visible in the reference library.
2. For each `exclude_pending_review` record, locate a primary publication, agency dataset, or responsible institution source that identifies both the analog dimension and the named location; otherwise keep it out of any future authoritative subset while retaining it as an atlas lead.
3. Review exact coordinate provenance for all 29 point-bearing records. Capture source coordinate, location type, uncertainty statement, and geospatial footprint separately; do not infer uncertainty from decimal digits.
4. Mark every legacy atlas climate, elevation and mineral value as unverified atlas claims in user-facing detail. Resolve rainfall and inferred-mineral warnings before using those fields for evidence comparison.
5. Add reproducible provider validation by site and requested coordinate. Keep gridded/model products, map products, raw provider responses and derived summaries explicitly separated.
6. Enrich the evidence model where an important source dimension genuinely lacks evidence; rank the proposed repositories in [source registry](source-registry.md).

See [data lineage](data-lineage.md), [provider coverage](provider-coverage-matrix.csv), [site matrix](site-audit-matrix.csv), and [recommended actions](recommended-actions.md).
