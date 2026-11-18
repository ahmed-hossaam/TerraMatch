import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MoonMapView } from "./moon/MoonMapView.js";
import { getMoonCoverage, getMoonDatasets, getMoonLayers, getMoonLolaPreview, getMoonLolaPolarPreviews, getMoonMapConfig, getMoonSummary, type MoonCoverage, type MoonDatasetCollection, type MoonLayers, type MoonLolaPreview, type MoonLolaPolarPreviews, type MoonMapConfig, type MoonSummary } from "./moon/moon-api.js";
import "./moon/moon-page.css";

export default function MoonPage() {
  const [data, setData] = useState<{ summary: MoonSummary; datasets: MoonDatasetCollection; layers: MoonLayers; coverage: MoonCoverage; mapConfig: MoonMapConfig; lolaPreview: MoonLolaPreview; polarPreviews: MoonLolaPolarPreviews } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void Promise.all([getMoonSummary(), getMoonDatasets(), getMoonLayers(), getMoonCoverage(), getMoonMapConfig(), getMoonLolaPreview(), getMoonLolaPolarPreviews()])
      .then(([summary, datasets, layers, coverage, mapConfig, lolaPreview, polarPreviews]) => { if (active) setData({ summary, datasets, layers, coverage, mapConfig, lolaPreview, polarPreviews }); })
      .catch((reason: Error) => { if (active) setError(reason.message || "Moon catalog could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  return <div className="page moon-page">
    <header className="moon-page-head"><div><span className="eyebrow">DESTINATION · MOON</span><h1>Global lunar evidence catalog</h1><p>Explore the single acquired LOLA LDEM_4 product. Its processed relative-height grid is rendered below using the documented lunar pixel-to-coordinate mapping as an unvalidated research display; it is not independently scientifically validated or a standard CRS raster.</p></div><div className="moon-page-actions"><Link className="secondary-button" to="/explore">Open Explore →</Link><Link className="secondary-button" to="/moon/evidence">Open evidence gaps →</Link></div></header>
    {loading && <div className="notice" role="status">Loading Moon destination metadata…</div>}
    {error && <div className="notice notice-error" role="alert"><b>Moon API unavailable</b><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {!loading && !error && data && <>
      <section className="moon-summary-strip" aria-label="Moon data readiness summary"><div><span>Registered products</span><b>{data.summary.counts.registered}</b></div><div><span>Source acquired</span><b>{data.summary.counts.acquired}</b></div><div><span>File-inspected</span><b>{data.summary.counts.inspected ?? 0}</b></div><div><span>Pixel-decoded</span><b>{data.summary.counts.decoded ?? 0}</b></div><div><span>Processed</span><b>{data.summary.counts.processed}</b></div><div><span>Validated</span><b>{data.summary.counts.validated}</b></div><div><span>Validated map layers</span><b>{data.summary.counts.renderable}</b></div></section>
      <div className="moon-readiness-note"><b>LOLA research display · scientific validation incomplete</b><span>{data.summary.globalScope} Elevation colors are rendered from the checksum-verified processed NPY grid in the browser using the documented pixel-center equations. Rendering does not establish observed coverage or scientific validation.</span></div>
      <MoonMapView datasets={[...data.layers.renderableLayers, ...data.layers.registeredButUnavailableLayers]} configuration={data.mapConfig} lolaPreview={data.lolaPreview} polarPreviews={data.polarPreviews} />
      <section className="moon-coverage-section"><div><span className="eyebrow">COVERAGE STATUS · NO INFERRED PERCENTAGES</span><h2>Declared scope and observed coverage are different</h2><p>Coverage values remain unknown until product files are acquired and valid-data masks are assessed. Geographic extent is not a resolution statement.</p></div><div className="moon-coverage-grid">{data.coverage.datasets.map((item) => <article key={item.datasetId}><b>{datasetName(item.datasetId, data.datasets.items)}</b><span>{item.classification.replaceAll("_", " ")} · observations {item.coverageMeasurementStatus}</span><small>{item.nominalResolution ?? "Resolution unverified"}</small></article>)}</div></section>
    </>}
  </div>;
}
function datasetName(id: string, datasets: MoonDatasetCollection["items"]): string { return datasets.find((item) => item.datasetId === id)?.name ?? id; }
