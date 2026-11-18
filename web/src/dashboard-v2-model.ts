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
    : { available: false, message: "Moon discovery is unavailable: no validated lunar target study area and Earth search pipeline are configured." };
}

export function dashboardComparisonForDiscovery(runs: { runId: string; discoveryRunId?: string | null }[], discoveryRunId: string) {
  return runs.find((run) => run.discoveryRunId === discoveryRunId)?.runId ?? null;
}

export function workspaceRecordHref(kind: string | undefined, id: string, dashboardRunId?: string | null) {
  const recordId = encodeURIComponent(id);
  if (kind !== "candidate_region") return `/references/${recordId}`;
  return `/dashboard/candidate/${recordId}${dashboardRunId ? `?run=${encodeURIComponent(dashboardRunId)}` : ""}`;
}
