/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//
// Worker identity reported to processor code through the environment:
//
//   ARTILLERY_WORKER_INDEX - globally-dense 0-based ordinal of this
//                            load-generating worker across the whole run
//   ARTILLERY_WORKER_COUNT - total number of load-generating workers
//
// dist.ts already annotates every phase of a worker's script with a dense,
// 1-based `worker` ordinal and a `totalWorkers` count; this turns those into
// the env contract above so test code can take a non-overlapping slice of
// shared data without any cross-worker coordination.
//
// Distributed runs are two-layered: unless --solo is used, each node runs a
// full `artillery run` with its own nested worker threads. The launcher
// therefore sets ARTILLERY_WORKER_BASE (this node's ordinal offset) and
// ARTILLERY_WORKER_COUNT (the global total), and the nested local ordinal is
// added to the base to keep indices globally dense.
//

// `phases` is a worker script's config.phases; all of its phases carry the
// same `worker`/`totalWorkers` annotations, so only the first is read.
export function workerOrdinalEnv(phases, env) {
  const phase = phases?.[0];
  const localIndex = (phase?.worker ?? 1) - 1;
  const base = Number(env.ARTILLERY_WORKER_BASE ?? '0') || 0;

  return {
    ARTILLERY_WORKER_INDEX: String(base + localIndex),
    // set by the launcher on distributed platforms; derived from the phases
    // when running standalone-local
    ARTILLERY_WORKER_COUNT:
      env.ARTILLERY_WORKER_COUNT ?? String(phase?.totalWorkers ?? 1)
  };
}

export function setWorkerOrdinalEnv(phases, env = process.env) {
  Object.assign(env, workerOrdinalEnv(phases, env));
}
