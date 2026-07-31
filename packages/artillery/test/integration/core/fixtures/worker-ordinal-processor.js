const fs = require('node:fs');
const path = require('node:path');
const { threadId } = require('node:worker_threads');

// Record the worker ordinal this thread was given. One file per thread, so
// that two threads claiming the same ordinal is detectable by the test.
function recordWorkerOrdinal(_context, _events, done) {
  fs.writeFileSync(
    path.join(process.env.WORKER_ORDINAL_OUTPUT_DIR, `thread-${threadId}.json`),
    JSON.stringify({
      index: process.env.ARTILLERY_WORKER_INDEX,
      count: process.env.ARTILLERY_WORKER_COUNT
    })
  );

  return done();
}

module.exports = {
  recordWorkerOrdinal
};
