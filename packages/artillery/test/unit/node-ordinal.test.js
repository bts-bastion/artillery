/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { test } = require('node:test');
const assert = require('node:assert');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { nodeOrdinalEnv } = require('../../lib/platform/node-ordinal.ts');
const PlatformLambda = require('../../lib/platform/aws-lambda/index.ts').default;
const { workerOrdinalEnv } = require('../../lib/platform/local/worker-ordinal.ts');

test('nodeOrdinalEnv gives the 0-based index and the fleet size', () => {
  assert.deepStrictEqual(nodeOrdinalEnv(2, 5), {
    ARTILLERY_WORKER_INDEX: '2',
    ARTILLERY_WORKER_COUNT: '5',
    ARTILLERY_NODE_INDEX: '2',
    ARTILLERY_NODE_COUNT: '5'
  });
});

// Run PlatformLambda#runWorker for every worker of a fleet of `count`, with the
// AWS client stubbed out, and return the event each Lambda would be invoked with.
async function invokedEvents(count) {
  const events = [];
  const realSend = LambdaClient.prototype.send;
  LambdaClient.prototype.send = async (command) => {
    if (command.constructor.name === 'GetFunctionConfigurationCommand') {
      return { State: 'Active' };
    }
    if (command.constructor.name === 'InvokeCommand') {
      events.push(JSON.parse(command.input.Payload));
      return {};
    }
    throw new Error(`unexpected command ${command.constructor.name}`);
  };

  try {
    const platform = Object.create(PlatformLambda.prototype);
    Object.assign(platform, {
      region: 'us-east-1',
      functionName: 'test-fn',
      sqsQueueUrl: 'https://sqs.test/queue',
      artilleryArgs: [],
      testRunId: 't1',
      bucketName: 'bucket',
      cloudKey: undefined,
      useVPC: false,
      count: 0,
      platformOpts: { count }
    });

    for (let i = 0; i < count; i++) {
      await platform.runWorker(`worker-${i}`, i);
    }
  } finally {
    LambdaClient.prototype.send = realSend;
  }

  return events;
}

test('every Lambda invocation carries its own index and the fleet size', async () => {
  const events = await invokedEvents(4);

  assert.strictEqual(events.length, 4);
  assert.deepStrictEqual(
    events.map((e) => e.ENV.ARTILLERY_WORKER_INDEX),
    ['0', '1', '2', '3'],
    'indices are 0-based and unique per Lambda'
  );
  assert.deepStrictEqual(
    events.map((e) => e.ENV.ARTILLERY_WORKER_COUNT),
    ['4', '4', '4', '4'],
    'count is --count'
  );
  assert.deepStrictEqual(
    events.map((e) => [e.ENV.ARTILLERY_NODE_INDEX, e.ENV.ARTILLERY_NODE_COUNT]),
    [
      ['0', '4'],
      ['1', '4'],
      ['2', '4'],
      ['3', '4']
    ]
  );
  assert.ok(
    events.every((e) => !('ARTILLERY_WORKER_BASE' in e.ENV)),
    'no stride/base variables'
  );
});

test('a single Lambda is index 0 of 1', async () => {
  const [event] = await invokedEvents(1);

  assert.strictEqual(event.ENV.ARTILLERY_WORKER_INDEX, '0');
  assert.strictEqual(event.ENV.ARTILLERY_WORKER_COUNT, '1');
});

test('a Lambda ordinal survives the nested local workers on that Lambda', async () => {
  // The worker handler spreads event ENV into the child `artillery run`; the
  // nested local layer must then leave it alone for every one of its threads.
  const events = await invokedEvents(3);
  const threads = 4;

  for (const [i, event] of events.entries()) {
    for (let t = 0; t < threads; t++) {
      const phases = [
        { duration: 10, arrivalRate: 1, worker: t + 1, totalWorkers: threads }
      ];
      assert.deepStrictEqual(workerOrdinalEnv(phases, event.ENV), {
        ARTILLERY_WORKER_INDEX: String(i),
        ARTILLERY_WORKER_COUNT: '3'
      });
    }
  }
});
