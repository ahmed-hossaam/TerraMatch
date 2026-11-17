# Phase 4 — Lunar Mapping

## Objective and Git state

Implement an isolated, scientifically honest Moon map experience without changing the Earth map or adding lunar features that are not backed by acquired data.

- Starting branch: `backend-preview-integration`
- Starting commit: `46b834d7b01080ab839e1d05f513fabc6ddd8f4a`
- Starting tree already contained uncommitted Phase 2/3 Moon work plus the two protected modified `web-dist/assets/maplibre-gl*` files.
- No branch switch, commit, push, deployment, database operation, migration, or environment change occurred.

## Work completed

Added a dedicated `web/src/moon/` map implementation. It uses the Phase 2 Moon destination/coordinate registry and coordinate transformation helper, rather than changing `web/src/MapView.tsx` or passing lunar positions through Earth mapping code.

The prototype shows a global equirectangular coordinate grid and selectable coordinate windows for global, near-side, far-side, north-polar, and south-polar views. The polar windows remain equirectangular and explicitly warn about distortion; they are not represented as polar projections. The view indicates provisional lunar coordinate metadata, planetocentric latitude, positive-east longitude, longitude domain, and the reference radius.

The map-layer adapter builds an inspectable catalog from all 13 Moon registry entries. A layer can be marked renderable only if it is lunar, acquired, processed, validated, map-delivery-complete, and uses a supported renderer. Current registry entries satisfy none of these operational requirements, so the map reports **0 renderable layers** and disables layer selection. The neutral map contains no fabricated raster, geological features, terrain, crater locations, or imagery.

## Renderer and supported behavior

- Renderer: responsive SVG equirectangular coordinate prototype, not MapLibre lunar rendering.
- Projection used by the display: geographic/equirectangular, routed through `projectLunarCoordinate` for coordinate validation and longitude convention handling.
- Coordinate reference: Moon body, provisional application reference, planetocentric latitude, positive-east longitude, −180° to 180°, 1,737,400 m radius reference.
- Implemented navigation: global, near/far longitude centers, north/south latitude windows, and bounded visual zoom.
- Supported layer metadata types: raster, vector, image footprint, point/track, derived coverage. These are contract options only; no type is currently operational.
- Unsupported: actual lunar basemap, polar projection renderer, image/raster/vector delivery, feature inspection, data-driven surface labels, and scientific regional feature navigation.
- Attribution: source links and attribution state are shown in each catalog item where present; unverified attribution remains labeled as such.

## Files created

- `web/src/moon/moon-map-types.ts`
- `web/src/moon/moon-map-adapter.ts`
- `web/src/moon/moon-map-layers.ts`
- `web/src/moon/MoonMapView.tsx`
- `web/src/moon/moon-map.css`
- `tests/moon-map.test.ts`

The Moon route is intentionally wired in Phase 5, not Phase 4. Existing Earth `MapView` code was not changed.

## Verification

- `npm test`: **124 passed, 0 failed**.
- `npm run check:web`: passed.
- Map tests cover Moon CRS enforcement, projection configuration, wrapped longitudes, invalid latitude rejection, all 13 registry mappings, zero false renderable layers, source limitations, and absence of Earth basemap imports.
- Browser/screenshot verification: not performed in this phase.

## Limitations and outstanding work

This is a coordinate-view prototype, not a scientific lunar map. It has no acquired product layers, tile service, geospatial feature source, or validated product footprints. The global/polar views are coordinate windows only; no named near-side/far-side terrain or geological regions are displayed. A future product-specific CRS may differ from the provisional application CRS and must be honored before rendering it.

No deployment or migration occurred. Earth map behavior is preserved because its component and setup were not modified; the Earth API and map regression checks run in the full test suite.
