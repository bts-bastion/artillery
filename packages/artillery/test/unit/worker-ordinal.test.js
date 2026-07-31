/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { test } = require('node:test');
const assert = require('node:assert');
const divideWork = require('../../lib/dist.ts').default;
const {
  workerOrdinalEnv,
  setWorkerOrdinalEnv
} = require('../../lib/platform/local/worker-ordinal.ts');

function scriptWithArrivalRate(arrivalRate) {
  return {
    config: {
      target: 'http://targ.get.url',
      phases: [{ duration: 10, arrivalRate }]
    },
    scenarios: [{ flow: [{ get: { url: '/' } }] }]
  };
}

test('worker ordinals are dense and 0-based across the workers of a local run', () => {
  const workerScripts = divideWork(scriptWithArrivalRate(40), 4);
  assert.strictEqual(workerScripts.length, 4, 'sanity: 4 worker scripts');

  const observed = workerScripts.map((s) =>
    workerOrdinalEnv(s.config.phases, {})
  );

  assert.deepStrictEqual(
    observed.map((e) => e.ARTILLERY_WORKER_INDEX),
    ['0', '1', '2', '3'],
    'indices are exactly {0..N-1} in worker order'
  );
  assert.deepStrictEqual(
    observed.map((e) => e.ARTILLERY_WORKER_COUNT),
    ['4', '4', '4', '4'],
    'every worker reports the same total count'
  );
});

test('idle workers are excluded, keeping the remaining ordinals dense', () => {
  // arrivalRate 2 over 4 workers leaves 2 workers idle; dist.ts filters them out
  const workerScripts = divideWork(scriptWithArrivalRate(2), 4);
  assert.strictEqual(workerScripts.length, 2, 'sanity: 2 non-idle workers');

  const observed = workerScripts.map((s) =>
    workerOrdinalEnv(s.config.phases, {})
  );

  assert.deepStrictEqual(observed, [
    { ARTILLERY_WORKER_INDEX: '0', ARTILLERY_WORKER_COUNT: '2' },
    { ARTILLERY_WORKER_INDEX: '1', ARTILLERY_WORKER_COUNT: '2' }
  ]);
});

test('ARTILLERY_WORKER_BASE offsets the local ordinal for distributed runs', () => {
  const workerScripts = divideWork(scriptWithArrivalRate(30), 3);
  const env = { ARTILLERY_WORKER_BASE: '6', ARTILLERY_WORKER_COUNT: '12' };

  const observed = workerScripts.map((s) =>
    workerOrdinalEnv(s.config.phases, env)
  );

  assert.deepStrictEqual(
    observed.map((e) => e.ARTILLERY_WORKER_INDEX),
    ['6', '7', '8'],
    'local ordinal is added to the base offset'
  );
  assert.deepStrictEqual(
    observed.map((e) => e.ARTILLERY_WORKER_COUNT),
    ['12', '12', '12'],
    'a launcher-provided global count is preserved, not derived from phases'
  );
});

test('a non-numeric ARTILLERY_WORKER_BASE is treated as no offset', () => {
  const env = { ARTILLERY_WORKER_BASE: 'not-a-number' };
  const phases = [{ duration: 10, arrivalRate: 1, worker: 2, totalWorkers: 4 }];

  assert.deepStrictEqual(workerOrdinalEnv(phases, env), {
    ARTILLERY_WORKER_INDEX: '1',
    ARTILLERY_WORKER_COUNT: '4'
  });
});

test('a script without phases defaults to the single-worker identity', () => {
  assert.deepStrictEqual(workerOrdinalEnv(undefined, {}), {
    ARTILLERY_WORKER_INDEX: '0',
    ARTILLERY_WORKER_COUNT: '1'
  });
  assert.deepStrictEqual(workerOrdinalEnv([], {}), {
    ARTILLERY_WORKER_INDEX: '0',
    ARTILLERY_WORKER_COUNT: '1'
  });
});

test('phases without worker annotations default to the single-worker identity', () => {
  // e.g. --solo, or the "multiply" local mode where every worker gets the
  // undivided script and dist.ts never annotates the phases
  const phases = [{ duration: 10, arrivalRate: 1 }];

  assert.deepStrictEqual(workerOrdinalEnv(phases, {}), {
    ARTILLERY_WORKER_INDEX: '0',
    ARTILLERY_WORKER_COUNT: '1'
  });
});

test('an unannotated script still honours a launcher-provided base and count', () => {
  // --solo on a distributed platform: one worker per node, so the node's base
  // offset alone identifies it
  const phases = [{ duration: 10, arrivalRate: 1 }];
  const env = { ARTILLERY_WORKER_BASE: '3', ARTILLERY_WORKER_COUNT: '5' };

  assert.deepStrictEqual(workerOrdinalEnv(phases, env), {
    ARTILLERY_WORKER_INDEX: '3',
    ARTILLERY_WORKER_COUNT: '5'
  });
});

test('setWorkerOrdinalEnv writes the ordinal onto the given env object', () => {
  const env = { PATH: '/usr/bin' };
  const phases = [{ duration: 10, arrivalRate: 1, worker: 3, totalWorkers: 7 }];

  setWorkerOrdinalEnv(phases, env);

  assert.strictEqual(env.ARTILLERY_WORKER_INDEX, '2');
  assert.strictEqual(env.ARTILLERY_WORKER_COUNT, '7');
  assert.strictEqual(env.PATH, '/usr/bin', 'unrelated env is left alone');
});
