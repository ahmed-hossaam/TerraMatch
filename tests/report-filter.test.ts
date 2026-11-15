import test from "node:test";
import assert from "node:assert/strict";
import { selectReportPairs } from "../src/report-filter.js";

const rows=[
  {candidateId:"candidate-a",referenceSiteId:"ref-1"},
  {candidateId:"candidate-a",referenceSiteId:"ref-2"},
  {candidateId:"candidate-b",referenceSiteId:"ref-1"},
];

test("report filters preserve the selected candidate and reference",()=>{
  assert.deepEqual(selectReportPairs(rows,"candidate-a","ref-2"),[rows[1]]);
  assert.deepEqual(selectReportPairs(rows,"candidate-b",null),[rows[2]]);
  assert.deepEqual(selectReportPairs(rows,null,"ref-1"),[rows[0],rows[2]]);
  assert.deepEqual(selectReportPairs(rows,null,"all"),rows);
});
