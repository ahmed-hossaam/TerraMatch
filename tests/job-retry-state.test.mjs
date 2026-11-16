import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompletedPayload, createRetryPayload } from "../server/workflows/job-retry-state.mjs";

test("retry state clears the previous attempt error and failure stage", () => {
  const retried = createRetryPayload({
    jobId: "preview-test-job",
    status: "failed",
    workflowRunId: "old-run",
    failureStage: "discovery",
    error: "previous attempt failed",
  }, "2026-11-16T00:00:00.000Z");
  assert.deepEqual(retried, {
    jobId: "preview-test-job",
    status: "retrying",
    workflowRunId: null,
    failureStage: null,
    error: null,
    updatedAt: "2026-11-16T00:00:00.000Z",
  });
});

test("completed state clears any previous attempt error details", () => {
  const completed = createCompletedPayload({ status:"failed", failureStage:"discovery", error:"old failure" }, "discovery-run", "comparison-run", "2026-11-16T00:00:00.000Z");
  assert.deepEqual(completed, {
    status:"completed", discoveryRunId:"discovery-run", comparisonRunId:"comparison-run",
    failureStage:null, error:null, updatedAt:"2026-11-16T00:00:00.000Z",
  });
});
