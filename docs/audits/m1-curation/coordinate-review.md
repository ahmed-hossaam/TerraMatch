# Coordinate review

All coordinates and uncertainty assessments are preserved in the curation overlay and site matrix. Original numbers are copied as read-only values; coordinate source, location type, stated uncertainty, sampling defensibility, and whether a coordinate represents a point or broad marker are separate fields. Decimal precision is never used as an accuracy estimate.

## Findings

- The M0 audit found 29 point-bearing records and two region-only records (SEM and LUT). Most point-bearing records are explicitly approximate; SAL and MDRS have a legacy non-approximate flag without a numeric uncertainty or a cited coordinate origin.
- Provider sampling is not defensible merely because a coordinate exists. Eight IDs have stored NASA POWER, Copernicus, and GLiM evidence, but those artifacts sample the recorded coordinate and do not establish that it is the correct field location.
- DEV is changed to `region_only`: the Death Valley marker (36.5, -117) is not the Badwater Basin study locality described by the linked paper. The point must not be sampled as if it were that study site.
- MDV is `region_only`: authoritative NASA program material supports the Dry Valleys as an analog region, but the record is a broad geographic region, not a validated sample point.
- SEM and LUT remain `region_only`, with no representative point.
- RAM has an official AMADEE-20 report locating the mission test area within Ramon Crater erosion structures. It does not establish the atlas marker as the test site or a geological sampling point.
- MDRS, MET, BON, ETN, LAN, and SVA have traceable site or regional research context; none of those sources validates the exact atlas marker as a field/sample coordinate. LAN and SVA remain pending because the record does not identify the specific studied locality.

## Coordinate policy

`region_only` and `exclude_pending_review` records are not eligible for point comparison in the M1 policy. `keep_with_limitations` points remain approximate study-area markers unless the overlay documents otherwise. The legacy reference archive retains its coordinates unchanged for provenance and existing consumer compatibility. The curation API flags sampling eligibility; no historical discovery or comparison artifact is rewritten.
