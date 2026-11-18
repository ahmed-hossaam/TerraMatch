import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("repeated discovery runs persist climate histories under run-scoped immutable paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "terramatch-run-scoped-climate-"));
  try {
    const source = `
      import { readFile } from 'node:fs/promises';
      import { pathToFileURL } from 'node:url';
      const root = process.env.TERRAMATCH_PROJECT_ROOT;
      const { runDiscovery } = await import(pathToFileURL(root + '/dist/src/discovery/run.js'));
      const profile = JSON.parse(await readFile(root + '/data/mission-profiles/mars-surface-v1.json', 'utf8'));
      const summary = (unit) => ({ mean: 10, min: 1, max: 20, validObservationCount: 1, missingObservationCount: 0, coveragePercent: 100, unit });
      const input = {
        studyArea: { id:'one-cell', label:'test only', boundingBox:{minLatitude:0,minLongitude:0,maxLatitude:0.1,maxLongitude:0.1}, spacingDegrees:0.1, maxCandidates:1, referenceExclusionKm:1 },
        missionProfile: profile, missionId:'extreme_environment_operations', references:[],
        retrieve: async () => ({ climate: { status:'success', normalized: {
          provider:'NASA POWER fixture', requestedPeriod:{start:'2000-01-01',end:'2000-01-01'}, actualObservationPeriod:{start:'2000-01-01',end:'2000-01-01'},
          parameters:['T2M','T2M_MAX','T2M_MIN','RH2M','PRECTOTCORR','WS10M'],
          summaries:{T2M:summary('°C'),T2M_MAX:summary('°C'),T2M_MIN:summary('°C'),RH2M:summary('%'),PRECTOTCORR:summary('mm/day'),WS10M:summary('m/s')},
          daily:[{date:'2000-01-01',temperatureRangeC:{value:19,qualityStatus:'valid'}}], provenance:{provider:'test fixture'}
        } } })
      };
      const first = await runDiscovery(input);
      const second = await runDiscovery(input);
      console.log(JSON.stringify({ first:first.candidates[0].sources.climate.normalizedDailyPath, second:second.candidates[0].sources.climate.normalizedDailyPath }));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
      cwd: root,
      env: { ...process.env, TERRAMATCH_PROJECT_ROOT: projectRoot },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const paths = JSON.parse(result.stdout.trim());
    assert.notEqual(paths.first, paths.second);
    assert.match(paths.first, /^data\/processed\/climate\/candidates\/[^/]+\/.+-daily\.json$/);
    assert.match(paths.second, /^data\/processed\/climate\/candidates\/[^/]+\/.+-daily\.json$/);
    const first = JSON.parse(await readFile(join(root, paths.first), "utf8"));
    const second = JSON.parse(await readFile(join(root, paths.second), "utf8"));
    assert.equal(first.provider, "NASA POWER fixture");
    assert.equal(second.provider, "NASA POWER fixture");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
