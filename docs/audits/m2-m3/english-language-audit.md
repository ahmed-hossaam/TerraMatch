# English-language audit — M2/M3

All newly authored M2/M3 documentation, source adapters, evidence labels and reference-detail UI text are English. API evidence records are generated from English profile metadata and the M1 API display projection; immutable source payloads are not exposed through the new evidence API.

The original Arabic-language atlas file and Arabic name/country metadata preserved in source reference records are unchanged. Existing API display mapping translates country labels and removes the source-language name from returned curation data. Raw provider responses remain untouched and are not copied to the public evidence endpoint. The repository scan found remaining Arabic characters only in immutable source material, source/normalized provenance metadata, and source-processing code that compares original values; none occur in M2/M3 user-facing content. Any such text exposed to users must be translated before release.
