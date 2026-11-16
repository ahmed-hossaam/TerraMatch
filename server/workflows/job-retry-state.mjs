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
