export interface DashboardCandidate {
  id: string;
  recordType?: string;
  latitude: number;
  longitude: number;
  status?: string;
  cellBounds?: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number } | null;
  sources?: Record<string, { status?: string }>;
  screening?: { reasons?: string[]; requiredFactors?: { factorId: string; status: string; note?: string }[] };
}

export const dashboardWorkspaceNavigation = [
  ["/dashboard", "Overview", "⌂"], ["/dashboard/explore", "Explore", "◎"], ["/dashboard/discover", "Discover", "⌕"],
  ["/dashboard/activity", "Research Activity", "◷"], ["/dashboard/results", "Results", "▤"], ["/dashboard/compare", "Compare", "⇄"],
] as const;

export const researchActivityFilters = ["All Activity", "Active", "Completed", "Failed", "Saved Research"] as const;
export type ResearchActivityFilter = typeof researchActivityFilters[number];

export function filterResearchJobs<T extends { status: string }>(jobs: T[], filter: ResearchActivityFilter) {
  if (filter === "Active") return jobs.filter((job) => ["queued", "running"].includes(job.status));
  if (filter === "Completed" || filter === "Saved Research") return filter === "Completed" ? jobs.filter((job) => job.status === "completed") : [];
  if (filter === "Failed") return jobs.filter((job) => job.status === "failed");
  return jobs;
}

export function discoveryRunsWithoutJobs<T extends { runId: string }>(runs: T[], jobs: { discoveryRunId?: string | null }[]) {
  const jobRunIds = new Set(jobs.map((job) => job.discoveryRunId).filter((id): id is string => !!id));
  return runs.filter((run) => !jobRunIds.has(run.runId));
}

export function dashboardCandidateRecords(candidates: DashboardCandidate[], studyAreaName: string) {
  return candidates
    .filter((item) => item.recordType === "candidate_region" && item.status === "evidence_supported_for_review" && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({
      id: item.id,
      name: studyAreaName || "Bounded Earth candidate",
      kind: "candidate_region" as const,
      latitude: item.latitude,
      longitude: item.longitude,
      approximate: true,
      detail: item.status,
      status: item.status,
      cellBounds: item.cellBounds ?? null,
    }));
}

export function dashboardTargetAvailability(body: "mars" | "moon") {
  return body === "mars"
    ? { available: true, message: "Mars observational context is available from Curiosity REMS at Gale Crater; Earth search is limited to a configured Atacama region." }
    : { available: false, message: "Lunar discovery is unavailable until independently validated lunar target data and a configured Earth search pipeline are available." };
}

export interface DiscoverSelections {
  body: "mars" | "moon";
  missionId: string;
  areaId: string;
}

/** Reset body-dependent choices on every target switch; only Mars has configured options today. */
export function switchDiscoverTarget(
  nextBody: "mars" | "moon",
  configuredMissionIds: string[],
  configuredAreaIds: string[],
  preferredMissionId = "extreme_environment_operations",
  preferredAreaId = "atacama-climate-transect-v2",
): DiscoverSelections {
  if (nextBody === "moon") return { body: "moon", missionId: "", areaId: "" };
  return {
    body: "mars",
    missionId: configuredMissionIds.includes(preferredMissionId) ? preferredMissionId : configuredMissionIds[0] ?? "",
    areaId: configuredAreaIds.includes(preferredAreaId) ? preferredAreaId : configuredAreaIds[0] ?? "",
  };
}

export function dashboardDiscoveryPayload(body: "mars" | "moon", missionId: string, areaId: string) {
  if (body !== "mars" || !missionId || !areaId) return null;
  return { missionId, studyAreaId: areaId };
}

export function dashboardComparisonForDiscovery(runs: { runId: string; discoveryRunId?: string | null }[], discoveryRunId: string) {
  return runs.find((run) => run.discoveryRunId === discoveryRunId)?.runId ?? null;
}

export function workspaceRecordHref(kind: string | undefined, id: string, dashboardRunId?: string | null) {
  const recordId = encodeURIComponent(id);
  if (kind !== "candidate_region") return `/references/${recordId}`;
  return `/dashboard/candidate/${recordId}${dashboardRunId ? `?run=${encodeURIComponent(dashboardRunId)}` : ""}`;
}
