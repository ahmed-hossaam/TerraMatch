# Release readiness

## Ready for a supervised prototype demonstration

The API-backed reference archive, curation labels, evidence details, bounded discovery workflow, current policy-filtered comparison and descriptive report are ready to show as a research prototype. The comparison head contains only the 24 M1-eligible references; the complete 31-record archive remains available separately. Error and unavailable states remain visible rather than being synthesized into values.

## Release conditions and blockers

- The current discovery head (`ca4250f9-7379-4fc1-af43-d0bd955ed68a`) is a legacy run without M1 eligibility metadata. The UI warns about it. New discovery runs now store the policy ID/version, but a fresh policy-tagged discovery run was not created in M5 to avoid repeating provider requests and overwriting same-ID candidate climate outputs. The current comparison was generated from the stored discovery and applies M1 eligibility to references.
- Provider failures are real: the archived discovery shows terrain failures for all three evaluated cells. This does not block a workflow demonstration, but it limits what the run can show.
- The project has not completed browser E2E or cross-device visual QA in this milestone. API integration tests, frontend type checking, build, responsive CSS inspection and route/source review passed.
- Large MapLibre (about 1.1 MB) and Three.js/react-three-fiber (about 0.9 MB) chunks still trigger Vite warnings. Three.js scene loading is now limited to Explore; no broad bundle-splitting work was attempted.
- Scientific expert review and independent validation remain necessary before any analog-validity or mission-suitability claims.

## Decision

Ready for final submission as a transparent Mars-first evidence-triage prototype. Do not present it as an analog ranking or validated suitability engine. Clearly label the bounded demonstration, source failures, reference curation and missing evidence.
