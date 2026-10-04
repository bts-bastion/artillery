/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//
// Worker identity reported to processor code through the environment:
//
//   ARTILLERY_WORKER_INDEX - 0-based ordinal of this worker
//   ARTILLERY_WORKER_COUNT - total number of workers
//
// dist.ts already annotates every phase of a worker's script with a dense,
// 1-based `worker` ordinal and a `totalWorkers` count; this turns those into
// the env contract above so test code can take a non-overlapping slice of
// shared data without any cross-worker coordination.
//
// If both variables are already present in the environment, they were set by a
// distributed control plane (e.g. the Lambda platform puts them in the event
// ENV of each Lambda, where they identify the Lambda and the size of the
// fleet) and are left as they are: every nested local worker inside that node
// shares the node's ordinal.
//

// `phases` is a worker script's config.phases; all of its phases carry the
// same `worker`/`totalWorkers` annotations, so only the first is read.
export function workerOrdinalEnv(phases, env) {
  if (env.ARTILLERY_WORKER_INDEX !== undefined && env.ARTILLERY_WORKER_COUNT !== undefined) {
    return {
      ARTILLERY_WORKER_INDEX: env.ARTILLERY_WORKER_INDEX,
      ARTILLERY_WORKER_COUNT: env.ARTILLERY_WORKER_COUNT
    };
  }

  const phase = phases?.[0];

  return {
    ARTILLERY_WORKER_INDEX: String((phase?.worker ?? 1) - 1),
    ARTILLERY_WORKER_COUNT: String(phase?.totalWorkers ?? 1)
  };
}

export function setWorkerOrdinalEnv(phases, env = process.env) {
  Object.assign(env, workerOrdinalEnv(phases, env));
}
