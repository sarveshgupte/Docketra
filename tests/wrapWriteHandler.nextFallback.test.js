const assert = require('assert');
const wrapWriteHandler = require('../src/middleware/wrapWriteHandler');

(async () => {
  const req = { skipTransaction: true };
  let statusCode = null;
  let payload = null;
  const res = {
    headersSent: false,
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };

  const handler = wrapWriteHandler(async () => {
    throw Object.assign(new Error('boom'), { code: 'BOOM', status: 500 });
  });

  await handler(req, res);

  assert.strictEqual(statusCode, 500);
  assert.strictEqual(payload.code, 'BOOM');
  assert.strictEqual(payload.success, false);
  console.log('wrapWriteHandler.nextFallback.test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
