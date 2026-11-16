import { useEffect, useState } from "react";
import { api } from "./api.js";

type Quantiles = { q25: number | null; median: number | null; q75: number | null };
type EvidenceArtifact = {
  status: string;
  generatedAt: string;
  dataset: {
    datasetId: string; volumeId: string; productVersion: string; datasetUrl: string;
    volumeUrl: string; temperatureDocumentationUrl: string; sisUrl: string;
  };
  measurement: { name: string; parameter: string; unit: string; type: string };
  coverage: {
    firstSelectedSol: number; lastSelectedSol: number; selectedSolCount: number;
    sourceProductCount: number; sourceRecordCount: number; lsBinsWithValidSamples: string[];
    sourceCoverageDescription: string;
    noProductSolDetails?: Array<{ sol: number; reason: string; httpStatus?: number | null }>;
  };
  qualityControl: {
    validSampleCount: number; rejectedSampleCount: number; terramatchFilter: string;
    productLabelDefinition?: string; unknownContextFlagRecordCount?: number;
    rejectionCounts: Record<string, number>;
    confidenceCharacterCounts?: Array<Record<string, number>>;
  };
  summary: { solarLongitudeBins: Array<{
    bin: string; validSampleCount: number; rejectedSampleCount: number;
    sampledSolTemperatureDistributionK: Quantiles & { validSampleCount: number; sampledSolCount: number };
    perSolObservedSampleRangeK: Quantiles & { validSolCount: number };
  }> };
  earthReferenceComparisons: Array<{
    siteId: string; status: string;
    mars: { validSampleCount: number; validSolCount: number; q25K: number | null; medianK: number | null; q75K: number | null };
    earth: { period: { start: string; end: string } | null; validObservationCount: number; missingObservationCount: number; q25: number | null; median: number | null; q75: number | null };
    limitations: string[];
  }>;
  provenance: { rawFiles: Array<{
    sol: number; productId: string | null; productUrl: string; sourceSha256: string;
    labelSha256: string; retrievedAt: string; startUtc?: string; stopUtc?: string;
  }> };
  evidenceDimensions: Array<{ dimensionId: string; name: string; marsObservationStatus: string; note: string }>;
  missionEvidenceGaps: Array<{
    missionId: string; missionName: string; objective: string;
    requiredFactors: Array<{
      factorId: string; name: string; dimensionName: string; status: string;
      marsEvidence: string; earthEvidence: string; limitation: string; nextEvidenceNeeded: string;
    }>;
  }>;
  scientificLimitations: string[];
};

function fmt(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "Not available";
}

export default function MarsEvidence() {
  const [data, setData] = useState<EvidenceArtifact | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMissionId, setSelectedMissionId] = useState("extreme_environment_operations");

  useEffect(() => {
    let active = true;
    api<EvidenceArtifact>("/mars-evidence/rems")
      .then((value) => { if (active) setData(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedMission = data?.missionEvidenceGaps.find((mission) => mission.missionId === selectedMissionId)
    ?? data?.missionEvidenceGaps[0];

  return <div className="page mars-evidence-page">
    <header className="page-head mars-page-head">
      <div>
        <div className="eyebrow">MARS OBSERVATIONS · CLAIM BOUNDARIES</div>
        <h1>What the evidence can say.</h1>
        <p>Curiosity REMS observations are shown beside Earth reference evidence with their measurement and coverage differences kept explicit.</p>
      </div>
    </header>

    {loading && <div className="empty-evidence" role="status">Loading stored REMS evidence…</div>}
    {error && <div className="notice notice-error"><b>Mars observational evidence unavailable</b><p>{error}</p><p>The page does not substitute mock values when the source artifact is missing.</p></div>}

    {data && <>
      <section className="mars-overview" aria-label="REMS observation summary">
        <div className="mars-overview-copy">
          <div className="eyebrow">GALE CRATER · CURIOSITY REMS · NASA PDS MODRDR</div>
          <h2>{data.status === "available" ? "Reduced rover air-temperature observations" : "No samples passed the documented filter"}</h2>
          <p>{data.measurement.type}. These are ambient-air estimates, not ground-temperature observations or complete daily extrema.</p>
          <p className="mars-overview-meta">{data.coverage.sourceProductCount} retrieved source products · {data.coverage.selectedSolCount} sols · {data.coverage.sourceRecordCount.toLocaleString()} source rows</p>
        </div>
        <div className="mars-count-grid">
          <div><strong>{data.qualityControl.validSampleCount.toLocaleString()}</strong><span>accepted samples</span></div>
          <div><strong>{data.qualityControl.rejectedSampleCount.toLocaleString()}</strong><span>rejected records</span></div>
          <div><strong>{data.coverage.selectedSolCount}</strong><span>sampled sols</span></div>
          <div><strong>{data.coverage.noProductSolDetails?.length ?? 0}</strong><span>planned sols unavailable</span></div>
        </div>
      </section>

      <section className="mars-claim-boundary" aria-label="Comparison boundary">
        <div className="mars-boundary-heading"><span className="mars-status-tag">AMBIGUOUS</span><h2>Why Mars–Earth temperature comparisons are not direct</h2></div>
        <p>REMS is an irregularly sampled, rover-mast ambient-air estimate in kelvin. NASA POWER T2M is gridded/model-derived daily air temperature at 2 m in °C. Their periods, sampling cadence, measurement height, and basis are not aligned, so this page presents descriptive distributions only—no paired observations or cross-source difference.</p>
        <div className="mars-reference-list"><b>Earth references with stored POWER histories</b><span>{data.earthReferenceComparisons.map((row) => row.siteId).join(" · ")}</span></div>
        <p className="mars-small-boundary">An Earth day is not a Mars sol. No humidity comparison is included; pressure has no matching Earth counterpart in this integration.</p>
      </section>

      <section className="mars-section mars-section-compact" aria-label="Evidence claim types">
        <div className="eyebrow">EVIDENCE CLASSES</div>
        <div className="mars-evidence-class-list">
          <span><b>Observed</b> REMS MODRDR rows and PDS confidence codes</span>
          <span><b>Derived</b> QC-filtered per-sol summaries, sample quantiles, Mars24 Ls bins</span>
          <span><b>Interpreted</b> Unpaired context beside modeled Earth T2M</span>
          <span><b>Hypotheses</b> None generated or validated here</span>
        </div>
      </section>

      <section className="mars-section" aria-label="Seasonal REMS summary">
        <div className="mars-section-heading">
          <div><div className="eyebrow">SEASONAL DESCRIPTION · SOLAR LONGITUDE</div><h2>Temperatures by Ls</h2></div>
          <span className="mars-inline-meta">30° bins · K</span>
        </div>
        <p>Quantiles summarize accepted rows from the selected sol(s) in each bin. They describe within-sol samples, not between-sol or multi-year variability and not a continuous climatology. Ls is derived from the product UTC interval midpoint using the documented Mars24 algorithm.</p>
        <details className="mars-disclosure">
          <summary><span>Open the 12-bin temperature table</span><small>Two bins have no retrieved products</small></summary>
          <div className="mars-table-scroll" role="region" aria-label="REMS temperatures by solar longitude" tabIndex={0}>
            <table><thead><tr><th>Ls bin</th><th>Valid samples</th><th>Sampled sols</th><th>Sample temperature q25 / median / q75 (K)</th><th>Observed within-sol range q25 / median / q75 (K)</th></tr></thead>
              <tbody>{data.summary.solarLongitudeBins.map((bin) => <tr key={bin.bin}><td>{bin.bin}°</td><td>{bin.validSampleCount.toLocaleString()}</td><td>{bin.sampledSolTemperatureDistributionK.sampledSolCount}</td><td>{fmt(bin.sampledSolTemperatureDistributionK.q25)} / {fmt(bin.sampledSolTemperatureDistributionK.median)} / {fmt(bin.sampledSolTemperatureDistributionK.q75)}</td><td>{fmt(bin.perSolObservedSampleRangeK.q25)} / {fmt(bin.perSolObservedSampleRangeK.median)} / {fmt(bin.perSolObservedSampleRangeK.q75)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mars-section" aria-label="Earth reference distributions">
        <div className="mars-section-heading">
          <div><div className="eyebrow">EARTH CONTEXT · NOT PAIRED OBSERVATIONS</div><h2>NASA POWER reference distributions</h2></div>
          <span className="mars-inline-meta">{data.earthReferenceComparisons.length} sites</span>
        </div>
        <p>Each listed reference has a stored 2001-01-01 through 2020-12-31 daily T2M history. Earth values remain model-derived context; they are not ground-station observations.</p>
        <details className="mars-disclosure">
          <summary><span>Open Earth and REMS distribution details</span><small>All cross-source statuses: ambiguous</small></summary>
          <div className="mars-table-scroll" role="region" aria-label="NASA POWER and REMS descriptive distributions" tabIndex={0}>
            <table><thead><tr><th>Earth reference</th><th>NASA POWER period</th><th>POWER T2M q25 / median / q75 (°C)</th><th>Coverage</th><th>Mars REMS context q25 / median / q75 (K)</th><th>Status</th><th>Site-specific limitations</th></tr></thead>
              <tbody>{data.earthReferenceComparisons.map((row) => <tr key={row.siteId}><td>{row.siteId}</td><td>{row.earth.period ? `${row.earth.period.start} – ${row.earth.period.end}` : "Not available"}</td><td>{fmt(row.earth.q25)} / {fmt(row.earth.median)} / {fmt(row.earth.q75)}</td><td>{row.earth.validObservationCount.toLocaleString()} valid · {row.earth.missingObservationCount.toLocaleString()} missing</td><td>{fmt(row.mars.q25K)} / {fmt(row.mars.medianK)} / {fmt(row.mars.q75K)}</td><td>{row.status}</td><td><details className="mars-row-limitations"><summary>{row.limitations.length} notes</summary><ul>{row.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details></td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mars-section" aria-label="Mission evidence gaps">
        <div className="mars-section-heading">
          <div><div className="eyebrow">EVIDENCE GAP · FOUR MISSION PROFILES</div><h2>What each mission question still needs</h2></div>
          <span className="mars-inline-meta">{data.missionEvidenceGaps.length} profiles</span>
        </div>
        <div className="mars-mission-tabs" role="group" aria-label="Choose a mission profile">
          {data.missionEvidenceGaps.map((mission) => <button key={mission.missionId} id={`mission-tab-${mission.missionId}`} type="button" aria-pressed={selectedMission?.missionId === mission.missionId} aria-controls="mission-evidence-panel" onClick={() => setSelectedMissionId(mission.missionId)}>
            <span>{mission.missionName}</span><small>{mission.requiredFactors.length} required factors</small>
          </button>)}
        </div>
        {selectedMission && <article className="mars-mission-panel" id="mission-evidence-panel" aria-labelledby={`mission-heading-${selectedMission.missionId}`}>
          <div className="mars-mission-heading"><div><div className="eyebrow">{selectedMission.missionId.replaceAll("_", " ")}</div><h3 id={`mission-heading-${selectedMission.missionId}`}>{selectedMission.missionName}</h3><p>{selectedMission.objective}</p></div><span className="mars-inline-meta">{selectedMission.requiredFactors.length} required factors</span></div>
          <div className="mars-factor-list">{selectedMission.requiredFactors.map((factor) => <details className="mars-factor" key={factor.factorId}>
            <summary><span><b>{factor.name}</b><small>{factor.dimensionName}</small></span><span className={`mars-factor-status mars-factor-status--${factor.status.replaceAll("_", "-")}`}>{factor.status}</span></summary>
            <div className="mars-factor-detail"><p><b>Mars evidence:</b> {factor.marsEvidence}</p><p><b>Earth evidence:</b> {factor.earthEvidence}</p><p><b>Boundary:</b> {factor.limitation}</p><p><b>Next evidence needed:</b> {factor.nextEvidenceNeeded}</p></div>
          </details>)}</div>
        </article>}
      </section>

      <section className="mars-section" aria-label="Mars observational evidence by dimension">
        <div className="mars-section-heading"><div><div className="eyebrow">DIMENSIONAL COVERAGE</div><h2>What has Mars observational support here</h2></div><span className="mars-inline-meta">Availability is not confidence</span></div>
        <div className="mars-dimension-list">{data.evidenceDimensions.map((dimension) => <article key={dimension.dimensionId}>
          <div><b>{dimension.name}</b><span className="mars-factor-status">{dimension.marsObservationStatus.replaceAll("_", " ")}</span></div><p>{dimension.note}</p>
        </article>)}</div>
        <div className="mars-claim-note"><b>Claim boundary</b><p>Availability describes what was retrieved. It is not confidence, a readiness result, or proof that missing phenomena are absent. No Earth site is designated here as a confirmed Mars analog.</p></div>
      </section>

      <section className="mars-section mars-provenance-section" aria-label="Source and reproducibility">
        <details className="mars-disclosure">
          <summary><span>Source, quality-control rules, and reproducibility</span><small>{data.dataset.datasetId} · volume {data.dataset.volumeId}</small></summary>
          <div className="mars-detail-content">
            <p><b>Version:</b> {data.dataset.productVersion}. Selected per-sol MODRDR tables and matching labels were retrieved; raw downloads remain outside the repository. Derived artifact generated {new Date(data.generatedAt).toLocaleString()}.</p>
            <div className="mars-source-links"><a href={data.dataset.datasetUrl} target="_blank" rel="noreferrer">PDS dataset profile ↗</a><a href={data.dataset.volumeUrl} target="_blank" rel="noreferrer">PDS data volume ↗</a><a href={data.dataset.temperatureDocumentationUrl} target="_blank" rel="noreferrer">REMS temperature definitions ↗</a><a href={data.dataset.sisUrl} target="_blank" rel="noreferrer">REMS RDR documentation ↗</a></div>
            <p><b>QC rule:</b> {data.qualityControl.terramatchFilter} PDS confidence characters encode documented quality conditions; this two-byte filter is a TerraMatch rule, not a PDS universal threshold. Unknown ancillary flags remain counted in the source codes ({data.qualityControl.unknownContextFlagRecordCount?.toLocaleString() ?? "count unavailable"} rows have an unknown contextual flag).</p>
            <p><b>Coverage:</b> {data.coverage.sourceCoverageDescription}</p>
            <p><b>Unavailable planned products:</b> {(data.coverage.noProductSolDetails ?? []).map((item) => `sol ${item.sol} (${item.reason}${item.httpStatus ? `, HTTP ${item.httpStatus}` : ""})`).join("; ") || "none"}.</p>
            <p><b>Rejected record counts:</b> {Object.entries(data.qualityControl.rejectionCounts).map(([reason, count]) => `${reason}: ${count.toLocaleString()}`).join(" · ")}</p>
            {data.qualityControl.confidenceCharacterCounts && <div className="mars-qc-counts"><b>Observed confidence-code character counts by position</b>{data.qualityControl.confidenceCharacterCounts.map((counts, index) => <p key={index}>Byte {index}: {Object.entries(counts).map(([flag, count]) => `${flag} ${count.toLocaleString()}`).join(" · ")}</p>)}</div>}
            <h3>Retrieved product provenance</h3>
            <div className="mars-table-scroll" role="region" aria-label="Retrieved REMS product provenance" tabIndex={0}>
              <table><thead><tr><th>Sol</th><th>Product</th><th>Product URL</th><th>Label UTC interval</th><th>Table SHA-256</th><th>Label SHA-256</th><th>Retrieved</th></tr></thead><tbody>
                {data.provenance.rawFiles.map((file) => <tr key={file.sol}><td>{file.sol}</td><td>{file.productId ?? "Not available"}</td><td><a href={file.productUrl} target="_blank" rel="noreferrer">Open PDS product ↗</a></td><td>{file.startUtc ?? "Not available"} – {file.stopUtc ?? "Not available"}</td><td><code>{file.sourceSha256}</code></td><td><code>{file.labelSha256}</code></td><td>{new Date(file.retrievedAt).toLocaleString()}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </details>
        <details className="mars-disclosure mars-limitations-disclosure">
          <summary><span>All scientific limitations</span><small>{data.scientificLimitations.length} documented</small></summary>
          <ul className="mars-limitations">{data.scientificLimitations.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      </section>
    </>}
  </div>;
}
