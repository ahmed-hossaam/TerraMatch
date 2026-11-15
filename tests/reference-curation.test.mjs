import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest=JSON.parse(await readFile("data/curation/reference-curation-v1.json","utf8"));
const references=JSON.parse(await readFile("data/processed/reference-sites.json","utf8"));
const fixtures=JSON.parse(await readFile("data/processed/candidate-points.json","utf8"));
const decisions=new Set(["keep_verified","keep_with_limitations","region_only","exclude_pending_review"]);
test("curation has exactly one decision per reference stable ID",()=>{
 assert.equal(manifest.records.length,31); assert.equal(new Set(manifest.records.map(r=>r.stableId)).size,31);
 assert.deepEqual([...manifest.records.map(r=>r.stableId)].sort(),references.map(r=>r.id).sort());
 for(const r of manifest.records) assert.ok(decisions.has(r.preliminaryDecision),`${r.stableId} decision`);
});
test("curation does not absorb test fixtures or mutate source reference records",()=>{
 assert.equal(manifest.records.some(r=>fixtures.some(f=>f.id===r.stableId)),false);
 for(const r of references) assert.equal(manifest.records.find(c=>c.stableId===r.id).stableId,r.id);
 assert.equal(manifest.sourceInventory.count,references.length);
});
test("region-only and pending records cannot enter point comparison",()=>{
 for(const r of manifest.records.filter(r=>["region_only","exclude_pending_review"].includes(r.preliminaryDecision))) assert.equal(r.pointComparisonEligible,false,r.stableId);
 for(const r of manifest.records.filter(r=>r.preliminaryDecision==="region_only")) assert.equal(r.coordinateAssessment.providerSamplingDefensible,false,r.stableId);
});
test("evidence categories are explicit and verified claims have traceable source metadata",()=>{
 const categories=new Set(["primary_dataset","peer_reviewed_source","official_documentation","atlas_claim","derived_value","unverified","conflicting"]);
 for(const r of manifest.records){
  for(const evidence of Object.values(r.evidenceByDimension)) assert.ok(categories.has(evidence.status),`${r.stableId}:${evidence.status}`);
  for(const c of r.claimCitations) assert.ok(c.title&&c.authorsOrOrganization&&c.sourceType&&c.supportedClaimOrDimension&&c.geographicScope&&c.limitations,`${r.stableId} citation metadata`);
  assert.ok(r.knownLimitations.length>0);
 }
});
test("legacy zero values are not assigned as missing evidence by the curation layer",()=>{
 for(const r of manifest.records) for(const e of Object.values(r.evidenceByDimension)) assert.doesNotMatch(e.note,/missing.*zero|zero.*missing/i);
});
test("curation remains a separate file and provider absence is not called failure",()=>{
 assert.equal(manifest.sourceInventory.recordsPreserved,true);
 for(const r of manifest.records) for(const p of Object.values(r.providerCoverage)) if(p.status==="not_retrieved") assert.equal(p.failed,false);
});
