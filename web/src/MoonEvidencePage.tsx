import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMoonCoverage, getMoonDatasets, getMoonLayers, getMoonSummary, type MoonCoverage, type MoonDatasetCollection, type MoonLayers, type MoonSummary } from "./moon/moon-api.js";
import type { MoonDatasetEntry } from "../../src/moon/products/contracts.js";
import "./moon/moon-evidence.css";

export default function MoonEvidencePage() {
  const [data, setData] = useState<{ summary: MoonSummary; datasets: MoonDatasetCollection; layers: MoonLayers; coverage: MoonCoverage } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void Promise.all([getMoonSummary(), getMoonDatasets(), getMoonLayers(), getMoonCoverage()])
      .then(([summary, datasets, layers, coverage]) => { if (active) setData({ summary, datasets, layers, coverage }); })
      .catch((reason: Error) => { if (active) setError(reason.message || "Moon evidence catalog could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="page moon-evidence-page">
    <div className="moon-evidence-heading"><Link to="/moon" className="text-link">← Moon map and catalog</Link><span className="eyebrow">MOON · EVIDENCE GAPS</span><h1>Processed data is not yet a validated map layer.</h1><p>One LOLA LDEM_4 product has been processed into a Float32 relative-height array using the companion AUX NoData and scale metadata. It is not georeferenced, scientifically validated, or prepared for map delivery.</p></div>
    {loading && <div className="notice" role="status">Loading lunar evidence-gap matrix…</div>}
    {error && <div className="notice notice-error" role="alert"><b>Evidence catalog unavailable</b><p>{error}</p><button className="secondary-button" onClick={() => window.location.reload()}>Reload catalog</button></div>}
    {!loading && !error && data && <>
      <section className="moon-evidence-summary"><b>{data.summary.counts.registered} families registered</b><span>{data.summary.counts.acquired} acquired · {data.summary.counts.processed} processed · {data.summary.counts.validated} validated · {data.summary.counts.renderable} renderable</span><small>Coverage is product-specific. A global nominal footprint does not imply globally valid data or uniform resolution.</small></section>
      <section className="moon-coverage-key"><h2>Coverage states</h2><div><span><b>Global</b> declared whole-body product family</span><span><b>Near-global</b> broad coverage; gaps/observation modes remain</span><span><b>Regional / polar</b> limited geographic scope</span><span><b>Targeted</b> selected observation footprints</span><span><b>Unknown</b> extent not established</span></div></section>
      <section className="moon-evidence-cards" aria-label="All registered Moon evidence families">
        {data.datasets.items.map((dataset) => {
          const layer = [...data.layers.renderableLayers, ...data.layers.registeredButUnavailableLayers].find((item) => item.datasetId === dataset.datasetId);
          const coverage = data.coverage.datasets.find((item) => item.datasetId === dataset.datasetId);
          return <MoonEvidenceCard key={dataset.datasetId} dataset={dataset} layer={layer?.availability ?? "unsupported"} coverageStatus={coverage?.coverageMeasurementStatus ?? "unknown"} />;
        })}
      </section>
      <section className="moon-claim-boundaries"><h2>Claim boundaries</h2><ul>
        <li>Diviner brightness/surface-temperature products are not lunar air-temperature measurements.</li>
        <li>M³ and Clementine reflectance/spectral products are not direct mineral assays.</li>
        <li>LEND hydrogen indicators do not establish water ice. Radar signatures do not independently establish ice or composition.</li>
        <li>Illumination and permanently shadowed-region classifications depend on their DEM, horizon model, solar geometry, sampling, and thresholds; modeled shadow is not evidence of ice.</li>
        <li>LROC NAC imagery is targeted footprint data, not uniform global high-resolution coverage.</li>
        <li>LOLA and Kaguya LALT are distinct elevation products and have not been reconciled or fused.</li>
        <li>The USGS 1:5M geology product is interpreted mapping, not site-scale field truth.</li>
        <li>No Earth–Moon similarity, analog suitability, readiness, or ranking score is calculated.</li>
      </ul></section>
    </>}
  </div>;
}

function MoonEvidenceCard({ dataset, layer, coverageStatus }: { dataset: MoonDatasetEntry; layer: string; coverageStatus: string }) {
  return <article className="moon-evidence-card">
    <div className="moon-evidence-card-top"><div><span className="eyebrow">{dataset.category.replaceAll("_", " ")} · {dataset.spatialSupport.coverageClass.replaceAll("_", " ")}</span><h2>{dataset.name}</h2></div><span className={`moon-layer-state state-${layer}`}>{layer === "not_acquired" ? "Not acquired" : layer.replaceAll("_", " ")}</span></div>
    <div className="moon-evidence-fields"><Fact label="Source / mission" value={[dataset.provider, dataset.mission, dataset.instrument].filter(Boolean).join(" · ")}/><Fact label="Product / release" value={[dataset.productId, dataset.productVersion, dataset.release].filter(Boolean).join(" · ") || "No specific product selected"}/><Fact label="Product selection" value={stateLabel(dataset.lifecycle.productSelection)}/><Fact label="Metadata review" value={`${dataset.metadataStatus} · registry file-level completeness is partial or unverified`}/><Fact label="Acquisition" value={stateLabel(dataset.lifecycle.acquisition)}/><Fact label="File inspection" value={stateLabel(dataset.lifecycle.inspection)}/><Fact label="Pixel decoding" value={stateLabel(dataset.lifecycle.decoding)}/><Fact label="Processing" value={stateLabel(dataset.lifecycle.processing)}/><Fact label="Product validation" value={productValidationState(dataset)}/><Fact label="Validation adapter" value={stateLabel(dataset.lifecycle.validation)} /><Fact label="Map delivery" value={`${stateLabel(dataset.lifecycle.mapDelivery)} · ${layer.replaceAll("_", " ")}`}/><Fact label="Geographic support" value={`${dataset.spatialSupport.coverageClass.replaceAll("_", " ")} · ${dataset.spatialSupport.description}`}/><Fact label="Declared resolution" value={dataset.spatialSupport.nominalResolution ?? dataset.spatialSupport.effectiveResolution ?? "Unknown"}/><Fact label="Temporal support" value={temporalDescription(dataset)}/><Fact label="Observed / valid data coverage" value={coverageStatus === "unknown" ? dataset.lifecycle.acquisition === "acquired" ? "Geographic coverage remains unknown; NoData masking was applied to samples, but pixel locations are not georeferenced." : "Unknown; no product file has been assessed." : coverageStatus}/><Fact label="Quality / uncertainty" value={`${dataset.quality.status} · ${dataset.quality.uncertaintyDescription ?? "uncertainty metadata not established"}`}/><Fact label="Evidence class" value={[...new Set(dataset.variables.map((variable) => variable.evidenceClass))].join(", ")}/></div>
    <div className="moon-variable-list"><b>Variable meaning</b>{dataset.variables.map((variable) => <p key={variable.id}><strong>{variable.name}{variable.unit ? ` (${variable.unit})` : ""}:</strong> {variable.semantics}</p>)}</div>
    {dataset.sourceUrl && <p className="moon-source-link"><a href={dataset.sourceUrl} target="_blank" rel="noreferrer">Open source catalog or product record ↗</a><span>{dataset.attribution.status === "unverified" ? "Attribution unverified" : dataset.attribution.status === "partial" ? "Attribution partially reviewed" : "Attribution status recorded"}</span></p>}
    <details className="moon-limitations"><summary>Limitations and product metadata</summary><ul>{dataset.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><p>File format: {dataset.fileFormats.join("; ") || "unknown"}</p><p>Coordinate reference: {dataset.coordinateReference.referenceFrame ?? "frame unknown"}; {dataset.coordinateReference.latitudeType}; {dataset.coordinateReference.longitudeDirection}; {dataset.coordinateReference.longitudeDomain}; {dataset.coordinateReference.projection}</p><p>License/redistribution: {dataset.license.status}. {dataset.license.terms ?? "Terms require verification before redistribution."}</p></details>
  </article>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value || "Unknown"}</b></div>; }
function stateLabel(value: string): string { return value.replaceAll("_", " "); }
function productValidationState(dataset: MoonDatasetEntry): string { return dataset.lifecycle.validation === "completed" ? "Validated" : dataset.lifecycle.validation === "blocked" ? "Blocked" : dataset.lifecycle.acquisition === "not_acquired" ? "Pending · no acquired product to validate" : "Pending product validation"; }
function temporalDescription(dataset: MoonDatasetEntry): string { return [[dataset.temporalSupport.start, dataset.temporalSupport.end].filter(Boolean).join(" to "), dataset.temporalSupport.cadence, dataset.temporalSupport.accumulation].filter(Boolean).join(" · ") || "Unknown"; }
