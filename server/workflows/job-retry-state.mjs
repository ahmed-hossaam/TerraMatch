export function createRetryPayload(payload, updatedAt = new Date().toISOString()) {
  return {
    ...payload,
    status: "retrying",
    workflowRunId: null,
    failureStage: null,
    error: null,
    updatedAt,
  };
}

export function createCompletedPayload(payload, discoveryRunId, comparisonRunId, updatedAt = new Date().toISOString()) {
  return {
    ...payload,
    status: "completed",
    discoveryRunId,
    comparisonRunId,
    failureStage: null,
    error: null,
    updatedAt,
  };
}
