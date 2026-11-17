# Phase 8 — Scientific Processing and Map Delivery

## Outcome

**Processing foundation implemented; no scientific product processed or validated.** Phase 7 yielded no local source artifact, which is a hard prerequisite for processing. The offline code added in this phase is limited to metadata inspection and deterministic sample transformations that require all scale, offset, fill, and quality rules as explicit inputs. Tests use synthetic fixtures and are not lunar observations.

## Implemented

- Added `src/moon/processing/pds3-raster.ts`:
  - Reads a bounded subset of PDS3 detached image-label fields into a typed description.
  - Keeps label inspection explicitly separate from pixel decoding, NoData/QC validation, and coverage verification.
  - Applies only caller-supplied scale/offset/fill/quality rules; preserves `null` for absent/rejected samples.
  - Computes valid fraction only for the sample window supplied to the function and returns `null` for an empty window. It does not claim lunar/global coverage.
- Added `tests/moon-processing.test.ts` with a synthetic PDS3 label-shaped fixture, explicit fill/quality cases, and sample-window coverage checks.
- Existing `DerivedProductLineage` contract remains the lineage record for future processed products. No derived manifest or product was fabricated.

## Product status and map delivery decisions

| Product family | Processed here | Product validation | Map-ready / renderable | Reason |
|---|---:|---:|---:|---|
| LOLA `LDEM_4` candidate | No | No | No | Source bytes could not be retrieved; no pixel decoder or artifact checksum available. JP2 browser decoding is not verified. |
| USGS Unified Geologic Map GIS v2 | No | No | No | 224,413,040-byte package was not downloaded or inspected; GIS geometry/attribute behavior and browser vector conversion remain unverified. |
| Diviner GCP/PCP | No | No | No | No exact bounded TAB/XML or PCP file pair acquired; global and polar products remain separate. |
| Other 10 families | No | No | No | No raw products acquired. |

No CRS reprojection, raster decoding, geologic feature conversion, resampling, tile generation, coverage-area calculation, or delivery URL was implemented. No GDAL or other GIS dependency was added. Existing neutral SVG coordinate prototype is still the only map rendering.

## Verification

- `npm run build`: passed.
- Focused manifest and processing tests: **6 passed, 0 failed** (`node --test dist/tests/moon-processing.test.js dist/tests/moon-acquisition-manifest.test.js`).
- Test inputs are deliberately labeled synthetic; they verify parser/operation behavior only and cannot establish a product’s source metadata or validity.
- Product-level processing, checksum, output artifact, and delivery verification: **not run** because no raw product exists locally.

## Limitations and next prerequisite

The Phase 8 acceptance criteria for processing real products are not met. The next prerequisite is to make the official LOLA source reachable from a controlled acquisition environment, download the small `LDEM_4.JP2` product plus its PDS label/auxiliary metadata into an external cache, record checksums, then inspect pixels and NoData before generating any map product. For rendering, a supported JP2 decoder or a verified offline conversion tool must be selected and tested against the exact product. Do not mark the generic synthetic processing fixture as lunar data or map-ready.

No deployment, migration, production storage change, or Git commit/push occurred.
