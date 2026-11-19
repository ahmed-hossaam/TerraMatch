import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dashboardCandidateRecords, dashboardComparisonForDiscovery, dashboardDiscoveryPayload, dashboardTargetAvailability, dashboardWorkspaceNavigation, discoveryRunsWithoutJobs, filterResearchJobs, researchActivityFilters, switchDiscoverTarget, workspaceRecordHref } from "../web/src/dashboard-v2-model.js";
import { unsupportedRequiredFactors } from "../src/discovery/supported-factors.js";

test("Dashboard V2 maps only actual candidate records with finite coordinates", () => {
  const records = dashboardCandidateRecords([
    { id: "candidate-real", recordType: "candidate_region", latitude: -24.5, longitude: -69.2, status: "evidence_supported_for_review" },
    { id: "insufficient", recordType: "candidate_region", latitude: -24.4, longitude: -69.2, status: "insufficient_evidence" },
    { id: "overlap", recordType: "candidate_region", latitude: -24.3, longitude: -69.2, status: "rejected_reference_overlap" },
    { id: "reference", recordType: "reference_site", latitude: -24, longitude: -69 },
    { id: "missing-coordinate", recordType: "candidate_region", latitude: Number.NaN, longitude: -69 },
  ], "Atacama bounded search");

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: "candidate-real",
    name: "Atacama bounded search",
    kind: "candidate_region",
    latitude: -24.5,
    longitude: -69.2,
    approximate: true,
    detail: "evidence_supported_for_review",
    status: "evidence_supported_for_review",
    cellBounds: null,
  });
});

test("Dashboard V2 reports Mars bounded availability and keeps Moon discovery unavailable", () => {
  assert.equal(dashboardTargetAvailability("mars").available, true);
  const moon = dashboardTargetAvailability("moon");
  assert.equal(moon.available, false);
  assert.match(moon.message, /independently validated lunar target data/i);
  assert.match(moon.message, /configured Earth search pipeline/i);
});

test("Discover body switching clears Moon-incompatible choices and restores configured Mars defaults", () => {
  const marsSelection = { body: "mars" as const, missionId: "mars-profile", areaId: "atacama-area" };
  const moonSelection = switchDiscoverTarget("moon", ["mars-profile"], ["atacama-area"]);
  assert.deepEqual(moonSelection, { body: "moon", missionId: "", areaId: "" });
  assert.equal(dashboardTargetAvailability(moonSelection.body).available, false);
  assert.equal(dashboardDiscoveryPayload(moonSelection.body, "mars-profile", "atacama-area"), null);

  const returnedToMars = switchDiscoverTarget("mars", ["mars-profile"], ["atacama-area"]);
  assert.deepEqual(returnedToMars, marsSelection);
  assert.equal(dashboardTargetAvailability(returnedToMars.body).available, true);
  assert.deepEqual(dashboardDiscoveryPayload(returnedToMars.body, returnedToMars.missionId, returnedToMars.areaId), { missionId: "mars-profile", studyAreaId: "atacama-area" });
});

test("Discover switching does not restore unsupported Mars options", () => {
  assert.deepEqual(switchDiscoverTarget("mars", [], []), { body: "mars", missionId: "", areaId: "" });
});

test("Moon Discover is a single data-backed unavailable state with no Mars submission controls", async () => {
  const dashboard = await readFile("web/src/DashboardV2.tsx", "utf8");
  assert.match(dashboard, /body === "moon" \? "\/moon\/summary" : null/);
  assert.match(dashboard, /body === "moon" \? "\/moon\/datasets\?offset=0&limit=100" : null/);
  assert.match(dashboard, /dashboard-v2-lunar-state/);
  assert.match(dashboard, /lunarSummary\.data\?\.counts\?\.validated/);
  assert.match(dashboard, /lunarSummary\.data\?\.counts\?\.renderable/);
  assert.match(dashboard, /body === "mars" && <Panel className="dashboard-v2-job-panel"/);
  assert.match(dashboard, /body === "mars" && <><button className="primary-button"/);
  assert.match(dashboard, /DiscoverV2 body=\{targetBody\} onBodyChange=\{onTargetBodyChange\}/);
  assert.equal(/body === "moon" && <Notice>\{target\.message\}/.test(dashboard), false);
  assert.match(dashboard, /target\.available \|\| !payload/);
  const app = await readFile("web/src/App.tsx", "utf8");
  assert.match(app, /scopeLabel=.*targetBody==="moon"\?"MOON · TARGET":"MARS · SURFACE"/);
});

test("Dashboard restores the existing planet scene, shared research layout, and normalized MapLibre pins", async () => {
  const app = await readFile("web/src/App.tsx", "utf8");
  const dashboard = await readFile("web/src/DashboardV2.tsx", "utf8");
  const css = await readFile("web/src/workspace-space.css", "utf8");
  assert.match(app, /location\.pathname==="\/explore"\|\|location\.pathname==="\/dashboard\/explore"/);
  assert.match(app, /workspace-sun/);
  assert.match(app, /public-research-container/);
  assert.match(dashboard, /dashboard-v2-sidebar-about/);
  assert.match(css, /\.public-research-container\{[^}]*max-width:1540px/s);
  assert.match(css, /\.map-pin\{[^}]*appearance:none[^}]*border-radius:50%/);
  assert.match(css, /\.map-pin\.is-selected/);
  assert.match(css, /\.primary-nav \.research-dropdown\[open\]>summary:after\{transform:translateY\(1px\)!important\}/);
});

test("Dashboard workspace navigation contains only operational destinations", () => {
  assert.deepEqual(dashboardWorkspaceNavigation.map(([, label]) => label), ["Overview", "Explore", "Discover", "Research Activity", "Results", "Compare"]);
  assert.deepEqual(researchActivityFilters, ["All Activity", "Active", "Completed", "Failed", "Saved Research"]);
});

test("Research Activity separates active and terminal jobs and avoids duplicate discovery run cards", () => {
  const jobs = [
    { jobId: "queued", status: "queued", discoveryRunId: null },
    { jobId: "running", status: "running", discoveryRunId: null },
    { jobId: "done", status: "completed", discoveryRunId: "run-1" },
    { jobId: "failed", status: "failed", discoveryRunId: null },
  ];
  assert.deepEqual(filterResearchJobs(jobs, "Active").map((job) => job.jobId), ["queued", "running"]);
  assert.deepEqual(filterResearchJobs(jobs, "Completed").map((job) => job.jobId), ["done"]);
  assert.deepEqual(filterResearchJobs(jobs, "Failed").map((job) => job.jobId), ["failed"]);
  assert.deepEqual(discoveryRunsWithoutJobs([{ runId: "run-1" }, { runId: "run-legacy" }], jobs).map((run) => run.runId), ["run-legacy"]);
});

test("public research routes and Landing Page sections point to the detailed research destinations", async () => {
  const landing = await readFile("web/src/MissionLanding.tsx", "utf8");
  const app = await readFile("web/src/App.tsx", "utf8");
  assert.match(landing, /PLANETARY EVIDENCE/);
  assert.match(landing, /DATA &amp; SOURCES/);
  assert.match(landing, /METHODOLOGY/);
  assert.match(landing, /to="\/planetary-evidence"/);
  assert.match(landing, /to="\/data-sources"/);
  assert.match(app, /path="\/planetary-evidence"/);
  assert.match(app, /path="\/data-sources"/);
  assert.match(app, /path="\/methodology" element=\{wrap\(research\(<MethodologyPage\/>\)\)\}/);
  assert.match(app, /path="\/planetary-evidence" element=\{wrap\(research\(<PlanetaryEvidence\/>\)\)\}/);
  assert.match(app, /path="\/references"/);
  assert.match(app, /path="\/mars-evidence"/);
  assert.match(app, /path="\/moon"/);
});

test("public and research navigation use the concise workspace entry layout", async () => {
  const landing = await readFile("web/src/MissionLanding.tsx", "utf8");
  const app = await readFile("web/src/App.tsx", "utf8");
  const workspaceCss = await readFile("web/src/workspace-space.css", "utf8");
  const dashboardCss = await readFile("web/src/dashboard-v2.css", "utf8");
  assert.equal(/<Link to="\/">Home<\/Link>/.test(landing), false);
  assert.match(landing, /How It Works.*research-dropdown.*About.*Enter Workspace/s);
  assert.match(app, /isResearchPage=\["\/planetary-evidence","\/data-sources","\/methodology"\]/);
  assert.match(app, /research-page-header/);
  assert.match(app, /Enter Workspace/);
  assert.match(workspaceCss, /research-page-header \.header-actions\{display:none\}/);
  assert.match(workspaceCss, /dashboard-global-header \.header-actions\{grid-column:2;justify-self:end/);
  assert.match(workspaceCss, /research-dropdown\[open\]>summary:after/);
  assert.match(dashboardCss, /--dashboard-content-max/);
  assert.match(dashboardCss, /--dashboard-page-inline/);
});

test("all Dashboard routes share one structural content container including the legacy Explore page wrapper", async () => {
  const dashboard = await readFile("web/src/DashboardV2.tsx", "utf8");
  const workspace = await readFile("web/src/Workspace.tsx", "utf8");
  const css = await readFile("web/src/dashboard-v2.css", "utf8");
  assert.match(dashboard, /className="dashboard-v2-content"><div className="dashboard-v2-container">\{content\}<\/div><\/div>/);
  assert.match(dashboard, /segments\[0\] === "explore" && segments.length === 1\) content = <ExploreWorkspace dashboardV2 \/>/);
  assert.match(workspace, /className="page workspace-page"/);
  assert.match(css, /\.dashboard-v2-container\{box-sizing:border-box;display:flex;flex-direction:column;gap:var\(--dashboard-section-gap\);width:100%;max-width:var\(--dashboard-content-max\)/);
  assert.match(css, /\.dashboard-v2-container \.dashboard-v2-page,\.dashboard-v2-container \.page\.workspace-page\{display:contents\}/);
  assert.equal(/\.dashboard-v2-page\{(?:width|max-width|margin|padding):/.test(css), false);
  assert.match(css, /padding-inline:var\(--dashboard-page-inline\)/);
  assert.match(css, /@media\(max-width:1050px\).*--dashboard-page-inline/);
  assert.match(css, /@media\(max-width:760px\).*--dashboard-page-inline:16px/);
});

test("Dashboard detail and loading states retain the common first heading line", async () => {
  const dashboard = await readFile("web/src/DashboardV2.tsx", "utf8");
  assert.match(dashboard, /function LatestResults\(\)[\s\S]*?\{!latest\.data && <Header/);
  assert.match(dashboard, /<Header eyebrow="STORED EARTH DISCOVERY · BOUNDED REGION" title=\{run\.data\?\.studyArea/);
  assert.match(dashboard, /<Header eyebrow="EARTH CANDIDATE · SOURCE EVIDENCE" title=\{candidate\?\.id/);
  assert.match(dashboard, /dashboard-v2-heading-actions/);
});

test("Dashboard keeps legacy Runs and History deep links while using Research Activity as canonical navigation", async () => {
  const dashboard = await readFile("web/src/DashboardV2.tsx", "utf8");
  const model = await readFile("web/src/dashboard-v2-model.ts", "utf8");
  const css = await readFile("web/src/dashboard-v2.css", "utf8");
  assert.match(model, /\["\/dashboard\/activity", "Research Activity"/);
  assert.match(dashboard, /segments\[0\] === "history" \|\| segments\[0\] === "runs" \|\| segments\[0\] === "activity"/);
  assert.match(dashboard, /segments\[0\] === "history" \|\| segments\[0\] === "runs"\) && segments\[1\]/);
  assert.match(dashboard, /dashboard-v2-sidebar/);
  assert.match(dashboard, /terramatch-dashboard-sidebar/);
  assert.match(dashboard, /aria-expanded=\{mobileOpen\}/);
  assert.match(css, /sidebar-collapsed/);
  assert.match(css, /mobile-sidebar-open/);
});

test("only mission profiles with every required factor in the current pipeline are runnable", () => {
  assert.deepEqual(unsupportedRequiredFactors(["air_temperature_daily_mean", "mapped_lithology"]), []);
  assert.deepEqual(unsupportedRequiredFactors(["mapped_lithology", "mineral_evidence"]), ["mineral_evidence"]);
});

test("Dashboard V2 only associates a reference matrix with its recorded discovery run", () => {
  const comparisons = [
    { runId: "comparison-a", discoveryRunId: "discovery-a" },
    { runId: "comparison-b", discoveryRunId: "discovery-b" },
  ];
  assert.equal(dashboardComparisonForDiscovery(comparisons, "discovery-b"), "comparison-b");
  assert.equal(dashboardComparisonForDiscovery(comparisons, "discovery-missing"), null);
});

test("Dashboard V2 Explore opens candidate details in the matching V2 run context", () => {
  assert.equal(workspaceRecordHref("candidate_region", "candidate / one", "run-123"), "/dashboard/candidate/candidate%20%2F%20one?run=run-123");
  assert.equal(workspaceRecordHref("known_analog", "GKC", "run-123"), "/references/GKC");
  assert.equal(workspaceRecordHref("candidate_region", "candidate-one", null), "/dashboard/candidate/candidate-one");
});
