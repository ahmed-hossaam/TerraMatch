# Source Access Blockers and Rejected Results

All attempts are logged in `data/evidence/m2/retrieval-manifest-v1.json` and summarized in `actual-retrieval-results.csv`. A blocked request is not an empty search.

| Source/path | Attempt | Result | Scientific handling |
|---|---|---|---|
| USGS ScienceBase / TADP (MET) | Catalog title query and known item JSON | HTTP 403 | Access failure; no catalog result or release payload. A separate official USGS report for the named site was accessible and used. |
| PAAD (WHS) | ScienceBase catalog title query | HTTP 403 | Access failure; no PAAD rows acquired. PAAD is a dune-field dataset with 45 sites and useful core attributes, but availability of a relevant White Sands record was not established. [USGS PAAD page](https://www.usgs.gov/data/paad-planetary-aeolian-analog-database) |
| EarthChem/PetDB (MET) | Exploratory `/locations/point` coordinate request | HTTP 200, but response count 1,147 and first sample at 92.1951333 E, 29.2398333 N | Rejected as unfiltered/irrelevant; no result was saved as site evidence. |
| EarthChem/PetDB (MET, RTI) | Documented `boundingBox` filter requests | HTTP 502 on each | Service failures; cannot conclude no samples exist. PetDB v4 documentation lists boundingBox search, but the deployed service did not return results for these requests. [API docs](https://earthchem.github.io/ec-doc/documentation/petdb_api.html) |
| GEOROC (ETN) | Official geographic query interface and CSV download | HTTP 200 | Acquired four FeOt rows. Kept as regional-context records because the returned sample has broad bounds, not exact sample coordinates. The retrieval manifest timestamps successful file acquisition; an earlier failed export attempt, if any, is not represented as a successful response. |
| USGS Open-File Report (MET) | Official report full text | HTTP 200 | Extracted 195 report-table observations from Table 1. The linked ScienceBase data release remains unaccessed and report data are mount averages without table-level per-mount coordinates. |

Exact URLs, encoded query parameters, provider status, and downloaded payload paths are recorded in the manifest. For ScienceBase/EarthChem failures the command runner did not persist exact request timestamps; manifest `attemptedAt` remains null instead of being reconstructed or guessed. The successful GEOROC and report retrieval timestamps are preserved. No broad source database was downloaded.

GEOROC records preserve data terms and require attribution under CC BY-SA 4.0; see [citation guidance](https://georoc.eu/georoc/cite.asp). Treat provider values critically and follow original sample citations. No credentials were used or added.
