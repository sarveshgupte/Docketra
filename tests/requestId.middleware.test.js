const assert = require('assert');
const requestId = require('../src/middleware/requestId.middleware');

const run = async () => {
  const req = {};
  const headers = {};
  const res = {
    setHeader(key, value) {
      headers[key] = value;
    },
  };

  let nextCalled = false;
  requestId(req, res, () => {
    nextCalled = true;
  });

  assert.ok(nextCalled, 'middleware should call next');
  assert.ok(req.requestId, 'requestId should be attached to request');
  assert.strictEqual(headers['X-Request-ID'], req.requestId, 'X-Request-ID header should match requestId');
  assert.ok(req.correlationId, 'correlationId should be attached to request');
  assert.strictEqual(headers['X-Correlation-ID'], req.correlationId, 'X-Correlation-ID header should match correlationId');

  const existingReq = { requestId: 'req-fixed-id' };
  const existingHeaders = {};
  requestId(existingReq, { setHeader: (key, value) => { existingHeaders[key] = value; } }, () => {});
  assert.strictEqual(existingReq.requestId, 'req-fixed-id', 'existing requestId should be preserved');
  assert.strictEqual(existingHeaders['X-Request-ID'], 'req-fixed-id', 'header should use existing requestId');
  assert.strictEqual(existingHeaders['X-Correlation-ID'], 'req-fixed-id', 'existing requestId should be used as default correlationId');

  const forwardedReq = { headers: { 'x-request-id': ' upstream-trace-id ' } };
  const forwardedHeaders = {};
  requestId(forwardedReq, { setHeader: (key, value) => { forwardedHeaders[key] = value; } }, () => {});
  assert.strictEqual(forwardedReq.requestId, 'upstream-trace-id', 'middleware should reuse upstream request IDs');
  assert.strictEqual(forwardedHeaders['X-Request-ID'], 'upstream-trace-id', 'header should propagate sanitized upstream request ID');
  assert.strictEqual(forwardedHeaders['X-Correlation-ID'], 'upstream-trace-id', 'correlation header should default to sanitized request id');

  console.log('✓ requestId middleware test passed');
};

run().catch((error) => {
  console.error('requestId middleware test failed:', error);
  process.exit(1);
});
