/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//
// Launcher side of the worker-ordinal contract (see
// ./local/worker-ordinal.ts for the worker side that consumes it).
//
// On Lambda each invocation runs the public worker image, which spreads the
// event `ENV` into the child `artillery run` process. So the control plane has
// to put the ordinal into that ENV: ARTILLERY_WORKER_INDEX is the 0-based
// ordinal of the Lambda and ARTILLERY_WORKER_COUNT the size of the fleet
// (--count). Worker threads nested inside one Lambda share its ordinal.
//
// `nodeIndex` is the 0-based ordinal of the node being launched, `nodeCount`
// the total number of nodes for the run (--count).
export function nodeOrdinalEnv(nodeIndex, nodeCount) {
  return {
    ARTILLERY_WORKER_INDEX: String(nodeIndex),
    ARTILLERY_WORKER_COUNT: String(nodeCount),
    // same values, for information
    ARTILLERY_NODE_INDEX: String(nodeIndex),
    ARTILLERY_NODE_COUNT: String(nodeCount)
  };
}
