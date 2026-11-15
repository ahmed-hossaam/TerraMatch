# M06 — Reference dataset validation and expansion

## Status

**Reference curation, point-source retrieval, normalization, and validation complete for the supported prototype sources.** The original 26-site atlas and its normalized output remain unchanged. Five supplemental references were reviewed against identifiable publications and stored separately, producing a combined reference artifact with 31 records. Three have published point-area coordinates and were retrieved; Semail and Dasht-e Lut remain region-level records with null point coordinates.

The supplied `Mars_Analogues_Haneen_Ayman.json` does not contain these five sites or cite their site-specific literature. The M06 review therefore records that limitation and uses independently identified publications with direct links. It does not transfer unsupported mineral claims into normalized mineral evidence: all five additions have an empty mineral list.

## Files and commands

- `data/benchmarks/supplementary-site-review.json`: decisions, spatial granularity, coordinate notes, supported claims, limits, and citations.
- `scripts/build-reference-dataset.ts`: deterministic normalization of accepted additions and combination with the original 26 records.
- `data/processed/supplementary-known-sites.json`: the five additions, using the existing `LocationRecord` shape; unavailable measurements remain null.
- `data/processed/reference-sites.json`: 26 original normalized records plus five supplementary records.
- `scripts/validate-reference-sites.ts` and `data/processed/reference-sites-validation-report.json`: integrity and separation validation.
- `scripts/retrieve-supplementary-evidence.ts`: reuses the M02/M03/M04 adapters for point-located records; region-level records are skipped.
- `data/processed/supplementary-evidence/retrieval-report.json`: actual provider attempts and outcomes. Per-site normalized daily climate, terrain sample, and GLiM outputs are saved separately beside it.

```powershell
npm.cmd run build:reference-sites
npm.cmd run validate:reference-sites
npm.cmd run retrieve:supplementary-evidence
```

Set `SUPPLEMENTARY_SITE_IDS` to a comma-separated subset and `DISCOVERY_TIMEOUT_MS` to change the point requests. Region-level records are never submitted to point APIs.

## Decisions and evidence

| ID | Reference | Accepted spatial representation | Evidence note |
|---|---|---|---|
| DALL | Dallol Hydrothermal Field, Ethiopia | Approximate study-area coordinate 14.24 N, 40.30 E | Geophysical and geological studies identify the Dallol hydrothermal system and study area. Coordinate is not an individual pool/sample. |
| DAL | Dalangtan Playa pavement, Qaidam Basin, China | Approximate published sampling pavement coordinate 38.59556 N, 90.985 E | A 2024 study reports a pavement sample location; it is local, not representative of the whole playa. |
| SEM | Semail Ophiolite, Oman | Region-level; latitude/longitude null | The formation comprises distinct field localities and rock contexts; no single point is substituted for the region. |
| AHS-GH | Gypsum Hill springs, Axel Heiberg Island, Canada | Approximate spring-cluster coordinate 79.4083333 N, -90.7180556 W | Kept distinct from Colour Peak and Lost Hammer. Coordinate describes a cluster, not each spring outlet. |
| LUT | Dasht-e Lut aeolian analog region, Iran | Region-level; latitude/longitude null | The cited aeolian study defines a study-area extent; no representative point or comprehensive mineral survey is invented. |

Sources and full bibliographic labels are retained in the review artifact and per-record provenance. Selected primary sources include [Dallol geophysical study](https://www.sciencedirect.com/science/article/abs/pii/S1464343X10000257), [Dalangtan sampling study](https://journals.asm.org/doi/10.1128/aem.01072-23), [Samail Ophiolite field study](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2021EA001637), [High Arctic spring locations](https://www.arlis.org/docs/vol1/ICOP/55700698/Pdf/Chapter_067.pdf), and [Lut aeolian ridge study](https://www.sciencedirect.com/science/article/pii/S001910351630481X).

## Validation and retrieval result

- Preserved original atlas: **26/26**.
- Accepted supplementary references: **5**; pending: **0**; rejected: **0**.
- Combined reference dataset: **31**.
- Point retrieval eligible: **DALL, DAL, AHS-GH (3)**; region-level: **SEM, LUT (2)**.
- Supplementary provider retrieval: **9/9 successful** (NASA POWER, Copernicus GLO-30, and GLiM for DALL, DAL, AHS-GH). All three NASA POWER responses cover 2001-01-01 through 2020-12-31 with 100% coverage for the seven configured parameters. The normalized reference records retain climate summaries, a separate `elevationSampleM` point measurement, and the original GLiM code; detailed source-normalized files and raw responses remain separate.
- Copernicus elevation samples: DALL **-93.123 m**, DAL **3293.168 m**, AHS-GH **28.266 m**. These are single DSM pixel samples at approximate published coordinates, not site means or terrain metrics.
- GLiM codes returned: DALL `suds__` (unconsolidated sediments / dune sands), DAL `sumx__` (unconsolidated sediments / mixed grain size), and AHS-GH `smmx__` (mixed sedimentary rocks / mixed grain size). They remain generalized mapped evidence, not field truth or mineral detections.
- The unified supplementary reference records retain these source-linked values while leaving `elevationMeanM` null; the actual Copernicus point sample is stored as `elevationSampleM`, not misrepresented as a site mean. Mineral evidence, slope/roughness, and quantitative sediment/regolith properties remain in `missingFactors`.
- `validate:reference-sites`: valid; no duplicate IDs or invalid normalized records. The three original test fixtures remain in `candidate-points.json`, not the reference set.

M02/M03/M04 still contain real provider data for their original five sites (GKC, GKB, WDE, KHA, RTI); those files were not modified by M06. NASA POWER remains gridded, Copernicus is GLO-30 DSM point elevation, and GLiM is generalized map evidence. Region-level supplement measurements remain null. Approximate coordinates and source-specific uncertainty remain explicit.

## Limitation and next step

The point retrievals validate but remain limited by approximate coordinates and broad/global source resolution. Select and cite a particular Semail field locality and a particular Lut landform only if point retrieval is needed; the accepted records intentionally remain region-level for now. Rerun `npm.cmd run retrieve:supplementary-evidence` to refresh the three supported point records; `npm.cmd run build:reference-sites` rebuilds the combined reference dataset from the saved normalized evidence without network access.
