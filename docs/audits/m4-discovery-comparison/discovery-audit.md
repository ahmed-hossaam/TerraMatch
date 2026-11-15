# Discovery audit

## Existing behavior and eligibility

The production discovery script reads the complete reference archive and the M1 curation manifest, selects references with `pointComparisonEligible=true` and a `keep_verified` or `keep_with_limitations` disposition, and records the policy, eligible point IDs, excluded IDs, and archive count in each new run. Region-only and pending/excluded references remain in the archive and API library. They do not enter the production point-reference mask. `runDiscovery` now also rejects duplicate/non-known reference inputs and any reference explicitly listed as excluded by a supplied eligibility policy.

The overlap algorithm conservatively masks a grid cell when its footprint plus configured buffer reaches a coordinate-bearing eligible reference point. Coordinate-free region records are tracked as unmasked; invalid coordinates are recorded separately. A candidate center remains a grid-cell location and is not a field-site coordinate.

## Evidence gate and confirmed defect

Mission definitions supply required and optional factor IDs. Each new result records profile ID/version, mission ID, objective, required/optional states, missing factor IDs, reasons, and the scientific claim limit. Required evidence only produces `evidence_supported_for_review` when every required factor is marked available with a non-null value. Missing, failed, ambiguous, or null-valued factors prevent that status. No numeric thresholds, weights, or ranking are used.

The confirmed defect was that a factor marked available with `value: null` could satisfy the gate. The gate now normalizes that state to missing, and the run validator rejects required factors marked available without matching non-null evidence. Climate factors require finite means, positive valid observation counts and units; derived daily range requires valid extrema/range observations; GLiM must return nonempty features; elevation must have valid quality status, finite value, and meters. Unavailable and failed provider states remain explicit.

## Explanation/UI

The candidate details page shows the mission objective, required and optional factor states, per-factor mission dimension, source, unit, status, explanatory note, and the existing scientific limitations. Archived older results lacking objective/optional fields render a clear unavailable fallback. This is a focused extension of the existing design.

## Current demonstration

The existing archived demonstration remains unchanged. Its validator reports four configured cells, three evaluated as insufficient evidence, and one rejected by conservative reference overlap. For each of the three evaluated cells, NASA POWER and GLiM are recorded as successful and Copernicus terrain as failed. Provider outputs remain exactly as archived; M4 made no live requests and did not turn the artifact into a scientific discovery.

## Remaining limits

A provider success alone does not establish representativeness. The evidence-presence gate does not inspect all source quality dimensions as a single holistic scientific decision. Coordinate uncertainty, source spatial support, seasonal coverage, GLiM generalization, and the single-pixel DSM caveat remain visible but still require expert interpretation. Historical run schemas are intentionally not rewritten.
