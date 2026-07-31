const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { $ } = require('zx');

// Keep in sync with fixtures/worker-ordinal.yml
const ARRIVAL_RATE = 20;

test('every local worker is given a distinct, dense worker ordinal', async (_t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-ordinal-'));

  // The local platform spawns one worker thread per CPU minus one, and dist.ts
  // then drops workers left with no arrivals - so the fleet is also capped by
  // the phase's arrival rate.
  const expectedWorkers = Math.min(
    ARRIVAL_RATE,
    Math.max(1, os.cpus().length - 1)
  );

  try {
    await $({
      env: { ...process.env, WORKER_ORDINAL_OUTPUT_DIR: outputDir }
    })`artillery run ${__dirname}/fixtures/worker-ordinal.yml`;
  } catch (err) {
    console.error('There has been an error in test run execution: ', err);
    assert.fail(err);
  }

  const observed = fs
    .readdirSync(outputDir)
    .map((file) =>
      JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'))
    );
  fs.rmSync(outputDir, { recursive: true, force: true });

  assert.strictEqual(
    observed.length,
    expectedWorkers,
    'every worker thread should have run the scenario and reported its ordinal'
  );

  assert.deepStrictEqual(
    observed.map((o) => o.count),
    new Array(expectedWorkers).fill(String(expectedWorkers)),
    'every worker should report the same total worker count'
  );

  const indices = observed.map((o) => Number(o.index)).sort((a, b) => a - b);
  assert.deepStrictEqual(
    indices,
    [...new Array(expectedWorkers).keys()],
    `observed ordinals should be exactly {0..${expectedWorkers - 1}}, each once`
  );
});
