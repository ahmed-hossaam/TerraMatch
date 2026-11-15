export interface ReportPairIdentity { candidateId: string; referenceSiteId: string; }

/** Applies the visible comparison selection to printable report rows. */
export function selectReportPairs<T extends ReportPairIdentity>(pairs: T[], candidateId: string | null, referenceId: string | null): T[] {
  return pairs.filter(pair => (!candidateId || pair.candidateId === candidateId) && (!referenceId || referenceId === "all" || pair.referenceSiteId === referenceId));
}
