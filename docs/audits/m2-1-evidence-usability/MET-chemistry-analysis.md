# MET — Meteor Crater Chemistry Analysis

## What the rows represent

The retrieved source is USGS Open-File Report 2024-1062, Table 1, “Geochemical compositions, in weight percent, of pristine glass particles from Meteor Crater, measured by wavelength dispersive spectrometry.” The report states that one mount comprises fragments from a single impact-melt particle. It analyzed 42 mounts overall, then reports averages for **15 impact-melt particles that had pristine glass** in Table 1. That subset came from drill holes 45, 60, 94 and 95 and ranged from approximately 0.5 to 6.4 m depth. [Full USGS report](https://pubs.usgs.gov/publication/ofr20241062/full)

The normalized 195 records are 15 mount columns × 13 table rows. There are 12 major-oxide rows per mount (180 reported average values) and a `Total` row per mount (15 reported analytical totals). The table does not give the number of underlying spot analyses that went into each average. The `Total` row is treated as a reported analytical sum (`derived_value`), not another oxide observation.

## Parameters and presentation

Parameters, all reported in wt%, are `SiO2`, `Al2O3`, `FeO`, `MgO`, `CaO`, `Na2O`, `K2O`, `TiO2`, `MnO`, `P2O5`, `Cr2O3`, `NiO`, and `Total`. WDS is the reported method. The application presents a matrix with one row per particle/mount and one column per reported parameter; it does not chart these different oxide components as if they shared a common scale or represented independent samples.

## Spatial and scientific limits

These are impact-melt glass analyses from material collected in the Meteor Crater ejecta blanket. The report identifies four drill holes for the 15-particle subset, but Table 1 does not give individual mount coordinates or a per-mount coordinate mapping. The normalized latitude and longitude remain null. The samples are not values measured at the atlas point and do not enter any of the existing 19 point-comparison factors.

The evidence can support a cited statement that impact-melt glass chemistry was measured and summarized for this study area. It cannot establish a crater-wide composition, mineral abundance, site-surface mineral detection, or that a candidate is a Mars analog. The 15 reported averages are correlated by their study/sample context and must not be described as 180/195 independent samples.
