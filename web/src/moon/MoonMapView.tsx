import { useMemo, useState } from "react";
import "./moon-map.css";
import { createMoonMapConfiguration, toMoonMapPosition } from "./moon-map-adapter.js";
import { getDefaultMoonMapLayers, getRenderableMoonLayers } from "./moon-map-layers.js";
import type { MoonMapLayer } from "../../../src/moon/map-layers.js";
import type { CoordinateReference } from "../../../src/destinations/types.js";
import { projectLunarPolarCoordinate, unprojectLunarPolarCoordinate, type PolarHemisphere } from "../../../src/moon/coordinates.js";
import type { MoonLolaPreview, MoonLolaPolarPreviews } from "./moon-api.js";
import lolaPreviewRasterUrl from "../../../data/processed/moon/lola/ldem_4_relative-height-preview.png";
import northPolarRasterUrl from "../../../data/processed/moon/lola/ldem_4_north-polar-preview.png";
import southPolarRasterUrl from "../../../data/processed/moon/lola/ldem_4_south-polar-preview.png";
import lolaHeightNpyUrl from "../../../data/processed/moon/lola/ldem_4_height_m.npy?url";
import { moonCoordinateToLolaPixel, parseLolaNpy, type LolaGrid } from "./lola-sample-reader.js";

type ViewMode = "global" | "near" | "far" | "north-polar" | "south-polar";
const VIEW_SETTINGS: Record<ViewMode, { centerLongitude: number; label: string }> = {
  global: { centerLongitude: 0, label: "Global equirectangular display" },
  near: { centerLongitude: 0, label: "Near-side longitude center · 0° east" },
  far: { centerLongitude: 180, label: "Far-side longitude center · 180° east" },
  "north-polar": { centerLongitude: 0, label: "North polar stereographic · 50°N to pole" },
  "south-polar": { centerLongitude: 0, label: "South polar stereographic · 50°S to pole" },
};
const POLAR_WIDTH = 700;

export function MoonMapView({ datasets, configuration, lolaPreview, polarPreviews, onLayerSelect }: { datasets?: MoonMapLayer[]; configuration?: { coordinateReference: CoordinateReference; coordinateReferenceStatus: string; referenceRadiusM: number | null; prototypeNotice: string }; lolaPreview?: MoonLolaPreview; polarPreviews?: MoonLolaPolarPreviews; onLayerSelect?: (layer: MoonMapLayer) => void }) {
  const defaultConfig = useMemo(() => createMoonMapConfiguration(), []);
  const config = configuration ?? { coordinateReference: defaultConfig.coordinateReference, coordinateReferenceStatus: defaultConfig.coordinateReferenceStatus, referenceRadiusM: defaultConfig.radiusM, prototypeNotice: defaultConfig.prototypeNotice };
  const layers = datasets ?? getDefaultMoonMapLayers();
  const renderableCount = getRenderableMoonLayers(layers).length;
  const [view, setView] = useState<ViewMode>("global");
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [grid, setGrid] = useState<LolaGrid | null>(null);
  const [sample, setSample] = useState<{ longitude: number; latitude: number; row: number; column: number; centerLongitude: number; centerLatitude: number; value: number | null } | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const selected = layers.find((layer) => layer.datasetId === selectedLayer) ?? null;
  const central = VIEW_SETTINGS[view].centerLongitude;
  const polarHemisphere: PolarHemisphere | null = view === "north-polar" ? "north" : view === "south-polar" ? "south" : null;
  const polarMetadata = polarHemisphere ? polarPreviews?.projections.find((item) => item.hemisphere === polarHemisphere) : undefined;
  const polarImageUrl = polarHemisphere === "north" ? northPolarRasterUrl : southPolarRasterUrl;
  const longitudes = Array.from({ length: 13 }, (_, i) => central - 180 + i * 30);
  const latitudes = Array.from({ length: 7 }, (_, i) => -90 + i * 30);
  const toX = (lon: number) => ((lon - (central - 180)) / 360) * 720;
  const toY = (lat: number) => (90 - lat) * 2;
  const validCoordinateChecks = [toMoonMapPosition(0, 0, config.coordinateReference), toMoonMapPosition(180, 0, config.coordinateReference), toMoonMapPosition(0, 89, config.coordinateReference)];

  const sampleCoordinate = async (longitude: number, latitude: number) => {
    if (!lolaPreview) return;
    const pixel = moonCoordinateToLolaPixel(longitude, latitude);
    setSampleError(""); setSampleLoading(!grid);
    try {
      let actualGrid = grid;
      if (!actualGrid) {
        const response = await fetch(lolaHeightNpyUrl);
        if (!response.ok) throw new Error(`Processed LOLA grid request failed (${response.status}).`);
        const buffer = await response.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
        if (hash !== lolaPreview.input.sha256.toUpperCase()) throw new Error("Processed LOLA grid checksum does not match API provenance.");
        actualGrid = parseLolaNpy(buffer); setGrid(actualGrid);
      }
      const value = actualGrid.values[pixel.index];
      setSample({ longitude: ((longitude + 180) % 360 + 360) % 360 - 180, latitude, row: pixel.row, column: pixel.column, centerLongitude: pixel.centerLongitude, centerLatitude: pixel.centerLatitude, value: Number.isFinite(value) ? value : null });
    } catch (reason) { setSampleError((reason as Error).message || "LOLA grid could not be read."); }
    finally { setSampleLoading(false); }
  };

  const inspectGlobal = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 720;
    const y = ((event.clientY - rect.top) / rect.height) * 360;
    const mapX = (x - 360) / zoom + 360, mapY = (y - 180) / zoom + 180;
    void sampleCoordinate(central - 180 + mapX / 2, 90 - mapY / 2);
  };

  const inspectPolar = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!polarHemisphere || !polarMetadata) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * POLAR_WIDTH / zoom + POLAR_WIDTH / 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * POLAR_WIDTH / zoom + POLAR_WIDTH / 2;
    const pixelSize = polarMetadata.image.pixelSizeM;
    const point = unprojectLunarPolarCoordinate({ x: (x - POLAR_WIDTH / 2) * pixelSize, y: (POLAR_WIDTH / 2 - y) * pixelSize }, polarHemisphere, polarMetadata.projection.referenceSphereRadiusM);
    if (Math.abs(point.latitude) < polarMetadata.projection.cutoffLatitudeDegrees) { setSampleError("The selected coordinate falls outside this polar preview coverage cap."); return; }
    void sampleCoordinate(point.longitude, point.latitude);
  };

  return <section className="moon-map-shell" aria-label="Moon global and polar research previews">
    <div className="moon-map-toolbar"><div><span className="moon-eyebrow">MOON · GLOBAL COORDINATE PROTOTYPE</span><h2>Explore the lunar surface</h2></div>
      <div className="moon-map-controls" role="group" aria-label="Moon coordinate views">{(["global", "near", "far", "north-polar", "south-polar"] as ViewMode[]).map((mode) => <button type="button" key={mode} aria-pressed={view === mode} onClick={() => { setView(mode); setZoom(1); setSampleError(""); }}>{mode === "north-polar" ? "North polar" : mode === "south-polar" ? "South polar" : mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    </div>
    <div className="moon-map-layout"><div className="moon-map-main">
      <div className="moon-map-coordinate-banner"><b>{VIEW_SETTINGS[view].label}</b><span>{polarMetadata?.projection.referenceFrame ?? lolaPreview?.coordinateReference.frame ?? config.coordinateReference.referenceFrame} · planetocentric latitude · positive-east longitude · −180° to 180°</span></div>
      {polarHemisphere ? <div className="moon-map-viewport moon-polar-viewport" data-view={view}>
        {polarMetadata ? <svg className="moon-coordinate-map moon-polar-map" viewBox={`0 0 ${POLAR_WIDTH} ${POLAR_WIDTH}`} role="img" aria-label={`${polarHemisphere} polar stereographic reprojection of LOLA LDEM_4 relative-height research preview; not scientifically validated.`} onClick={inspectPolar}>
          <defs><clipPath id={`polar-clip-${polarHemisphere}`}><circle cx="350" cy="350" r={polarMetadata.projection.projectedCutoffRadiusM / polarMetadata.image.pixelSizeM}/></clipPath></defs>
          <g clipPath={`url(#polar-clip-${polarHemisphere})`} transform={`translate(350 350) scale(${zoom}) translate(-350 -350)`}>
            <image href={polarImageUrl} x="0" y="0" width="700" height="700" />
            {[50, 60, 70, 80].map((latitude) => { const rho = 2 * polarMetadata.projection.referenceSphereRadiusM * Math.tan((90 - latitude) * Math.PI / 360) / polarMetadata.image.pixelSizeM; return <g key={`lat-${latitude}`}><circle cx="350" cy="350" r={rho} fill="none" stroke="#a9b9c66a" strokeWidth="1"/><text x="354" y={350 - rho + 12}>{polarHemisphere === "north" ? latitude : -latitude}°</text></g>; })}
            {Array.from({ length: 12 }, (_, index) => index * 30).map((longitude) => { const edge = projectLunarPolarCoordinate({ longitude, latitude: polarHemisphere === "north" ? 50 : -50 }, polarHemisphere, polarMetadata.projection.referenceSphereRadiusM); const x = 350 + edge.x / polarMetadata.image.pixelSizeM, y = 350 - edge.y / polarMetadata.image.pixelSizeM; return <g key={`lon-${longitude}`}><line x1="350" y1="350" x2={x} y2={y} stroke="#a9b9c64a" strokeWidth="1"/><text x={350 + (x - 350) * 0.88} y={350 + (y - 350) * 0.88}>{longitude}°E</text></g>; })}
            <circle cx="350" cy="350" r="3" fill="#55c7e8"/><text x="350" y="365" textAnchor="middle">{polarHemisphere.toUpperCase()} POLE</text>
          </g>
        </svg> : <div className="moon-map-fallback" role="status">Polar preview metadata is unavailable; this view cannot be shown.</div>}
        <div className="moon-map-prototype-stamp">UNVALIDATED RESEARCH PREVIEW</div>
      </div> : <div className="moon-map-viewport" data-view={view} style={{ aspectRatio: "2 / 1" }}>
        <svg className="moon-coordinate-map" viewBox="0 0 720 360" preserveAspectRatio="none" role="img" aria-label={lolaPreview ? `${VIEW_SETTINGS[view].label}. LRO LOLA LDEM_4 relative-height display preview, not scientifically validated.` : `${VIEW_SETTINGS[view].label}. Neutral coordinate graticule only; no lunar scientific data shown.`} onClick={inspectGlobal}>
          <defs><clipPath id="moon-map-clip"><rect x="0" y="0" width="720" height="360" rx="8"/></clipPath><radialGradient id="moon-neutral-surface"><stop offset="0" stopColor="#59616b"/><stop offset="1" stopColor="#252d37"/></radialGradient></defs>
          <g clipPath="url(#moon-map-clip)" transform={`translate(360 180) scale(${zoom}) translate(-360 -180)`}><rect width="720" height="360" fill="url(#moon-neutral-surface)"/>
            {lolaPreview && (central === 180 ? [-360, 360] : [0]).map((offset) => <image key={`lola-${offset}`} href={lolaPreviewRasterUrl} x={offset} y="0" width="720" height="360" preserveAspectRatio="none"/>)}
            {latitudes.map((lat) => <g key={`lat-${lat}`}><line x1="0" x2="720" y1={(90 - lat) * 2} y2={(90 - lat) * 2} stroke={lat === 0 ? "#bbd5e5a8" : "#a9b9c64a"} strokeWidth={lat === 0 ? 1.6 : 1}/><text x="8" y={Math.max(13, (90 - lat) * 2 - 4)}>{lat}°</text></g>)}
            {longitudes.map((lon) => { const x = ((lon - (central - 180)) / 360) * 720; const label = ((lon % 360) + 360) % 360; const coordinate = toMoonMapPosition(label, 0, config.coordinateReference); return <g key={`lon-${lon}`}><line x1={x} x2={x} y1="0" y2="360" stroke={lon === central ? "#55c7e8bb" : "#a9b9c64a"} strokeWidth={lon === central ? 1.6 : 1}/><text x={x + 3} y="14">{label}°E</text><title>{coordinate.x.toFixed(0)}°E longitude in application geographic coordinates</title></g>; })}
            <text className="moon-map-center-label" x="360" y="183">{view === "far" ? "180°E CENTRAL MERIDIAN" : "0°E CENTRAL MERIDIAN"}</text>
            {!lolaPreview && <text x="360" y="347" textAnchor="middle">Neutral equirectangular coordinate grid · no acquired lunar feature data</text>}
          </g>
        </svg><div className="moon-map-prototype-stamp">{lolaPreview?.scientificStatus.previewLabel ?? "PROTOTYPE · NO SCIENTIFIC LAYERS"}</div>
      </div>}
      <div className="moon-map-zoom"><label htmlFor="moon-map-zoom">Coordinate view zoom</label><input id="moon-map-zoom" type="range" min="1" max="2.25" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/><span>{zoom.toFixed(2)}×</span></div>
      {lolaPreview && <div className="moon-elevation-legend" aria-label="Relative height legend"><b>LDEM_4 relative height · meters</b><div className="moon-elevation-gradient"/><div><span>{lolaPreview.display.rangeM[0].toLocaleString()} m</span><span>0 m reference sphere</span><span>{lolaPreview.display.rangeM[1].toLocaleString()} m</span></div><small>Colors clipped to the source grid's 1st–99th percentile display range; numeric samples are unchanged. Transparent pixels indicate non-finite processed samples or projected area outside the polar cap, not missing observations.</small></div>}
      <div className="moon-map-notice"><b>{polarHemisphere ? `${polarHemisphere === "north" ? "North" : "South"} polar stereographic research preview · not independently validated` : lolaPreview ? "Unvalidated research preview · not a scientific result" : "Projection limits"}</b><p>{polarHemisphere && polarMetadata ? `Spherical polar stereographic display projection; true scale at the pole, 0°E origin, ${polarMetadata.projection.cutoffLatitudeDegrees}° ${polarHemisphere === "north" ? "N" : "S"} cap, ${polarMetadata.image.pixelSizeM.toLocaleString()} m display pixels. ` : lolaPreview ? `LRO LOLA ${lolaPreview.product.id} ${lolaPreview.product.version} · ${lolaPreview.attribution}. Equirectangular image follows the PDS pixel-center mapping and is not a GeoTIFF/CRS product. ` : `${config.prototypeNotice} `}{lolaPreview ? `No independent RDR point check is complete. ${lolaPreview.limitations.join(" ")}` : "No acquired lunar feature data is displayed."}</p></div>
      {sampleLoading && <div className="moon-map-config-summary" role="status">Loading checksum-verified height grid for coordinate inspection…</div>}{sampleError && <div className="notice notice-error" role="alert">{sampleError}</div>}
      {sample && <div className="moon-pixel-readout" role="status"><b>LOLA grid cell at {sample.longitude.toFixed(3)}°E, {sample.latitude.toFixed(3)}°</b><span>Cell center {sample.centerLatitude.toFixed(3)}° lat, {sample.centerLongitude.toFixed(3)}°E · row {sample.row}, column {sample.column}</span><strong>{sample.value == null ? "NoData / unavailable" : `${sample.value.toLocaleString()} m relative height`}</strong><small>Single binned/interpolated GDR cell; not a point measurement. Independent spatial validation is incomplete.</small></div>}
      <div className="moon-map-config-summary"><span>Body radius reference: {config.referenceRadiusM?.toLocaleString()} m (provisional)</span><span>Coordinate checks: {validCoordinateChecks.length} valid test points</span><span>Active validated map layers: {renderableCount}</span></div>
    </div>
    <aside className="moon-layer-panel"><div><span className="moon-eyebrow">DATA LAYER CATALOG</span><h3>{layers.length} registered families</h3><p>{renderableCount} validated operational layers. The LOLA image is a separate unvalidated research preview.</p></div><div className="moon-layer-list">{layers.map((layer) => <article className="moon-layer-card" key={layer.datasetId}>
      <button className="moon-layer-select" type="button" disabled={layer.availability !== "renderable"} aria-pressed={selectedLayer === layer.datasetId} onClick={() => { setSelectedLayer(layer.datasetId); onLayerSelect?.(layer); }}><strong>{layer.name}</strong><span className={`moon-layer-state state-${layer.availability}`}>{labelAvailability(layer.availability)}</span></button>
      <div className="moon-layer-meta"><span>{layer.category.replaceAll("_", " ")} · {layer.coverage.coverageClass.replaceAll("_", " ")}</span><span>{layer.product ?? "Product not selected"}</span><span>Inspection: {layer.inspectionState.replaceAll("_", " ")} · decode: {layer.decodingState.replaceAll("_", " ")} · processing: {layer.processingState.replaceAll("_", " ")} · delivery: {layer.mapDeliveryState.replaceAll("_", " ")}</span></div>
      <p>{layer.reason}</p><button className="moon-layer-details-toggle" type="button" aria-expanded={expanded === layer.datasetId} onClick={() => setExpanded(expanded === layer.datasetId ? null : layer.datasetId)}>{expanded === layer.datasetId ? "Hide source details" : "Source and limitations"}</button>
      {expanded === layer.datasetId && <div className="moon-layer-details"><p><b>Provider:</b> {layer.attribution.citation ?? "Attribution not verified"}</p>{layer.attribution.url && <a href={layer.attribution.url} target="_blank" rel="noreferrer">Open source</a>}<p><b>Evidence class:</b> {layer.evidenceClass}</p><p><b>Nominal support:</b> {layer.coverage.nominalResolution ?? "Unverified"}</p><p><b>Temporal support:</b> {layer.coverage.description}</p>{layer.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div>}
    </article>)}</div>{selected && <div className="moon-layer-selected" role="status">Selected layer: {selected.name}. Layer status is recorded as renderable in the dataset registry.</div>}</aside>
  </div></section>;
}

function labelAvailability(status: MoonMapLayer["availability"]): string { return ({ renderable: "Renderable", not_acquired: "Not acquired", not_inspected: "Not inspected", decode_blocked: "Decode blocked", not_decoded: "Not decoded", not_processed: "Not processed", not_validated: "Not validated", not_delivery_ready: "Delivery unavailable", unsupported: "Unsupported" })[status]; }
