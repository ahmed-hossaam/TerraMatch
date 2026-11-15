# Evidence Usability Report

## Implementation

The normalized acquisition now includes a `recordContext` object on every supplemental record. It distinguishes extracted source/table record count, represented sample count and its basis, reported measurement count and its basis, distinct location count (or null), location-count basis, analytical context, and measurement interpretation. These counts are dataset-context metadata repeated per row; they are not added up across the 199 rows.

For MET, context records 195 extracted table values, 15 particles/mounts, 180 reported average oxide values, 15 analytical totals, and four named drill-hole contexts. The underlying spot-measurement count and mount-specific coordinates remain unavailable and are left null. For ETN, context records four CSV rows, one shared sample label, four component-position analyses, and unknown exact distinct-location count. A null count stays null.

The API already returns supplemental records from `GET /api/references/:id/evidence`; the extended context is exposed without including raw response text. The reference detail view now shows:

- **MET:** linked USGS report and a 15-mount × 13-parameter chemistry matrix, with 12 reported average oxides and the analytical Total clearly distinguished. It explains the 42-mount overall study and 15 pristine-glass subset, the four drill holes, no mount coordinates, and exclusion from point factors.
- **ETN:** linked GEOROC and cited paper, attribution condition, four component/position FeOt rows, the single shared SDV-1 label, broad bounds, unknown exact location count, and explicit non-representative status.

No chart was added. The MET entries are multiple chemical components with different interpretations, while the ETN table comprises different mineral/component positions; tabulation preserves those distinctions better than an aggregate graphic.

## Scientific boundaries

The MET dataset supports reporting measured/reported-average chemistry for a subset of Meteor Crater impact-melt glass. It cannot be used as 195 independent sample locations, a sample at the atlas marker, or a mineral detection. The GEOROC data supports four FeOt analyses within one sample-label/citation context in broad Etna/Sicily bounds. It cannot support a coordinate-level assignment, four independent locations, or detection/abundance of minerals at the TerraMatch point.

Both sources remain supplemental. No factor count, factor definition, M1 disposition, point-comparison eligibility, discovery logic, or comparison calculation changed. The M3 factor rows remain 31 × 19; the 3 fixtures remain separate. Existing discovery/comparison latest artifacts are byte-for-byte guarded by tests.

## Corrective annotations

The previous normalizer represented each Table 1 cell as a separate primary-source record and left its aggregation/sample denominator implicit. It also had no shared sample-count metadata for the four GEOROC rows. M2.1 preserves all 199 identifiers, values, units, source fields, null coordinates, and raw data while adding explicit dataset-level context to each normalized record. USGS `Total` values remain separate and are explicitly identified as reported analytical sums. The raw source payloads and M1 curation are unchanged.
