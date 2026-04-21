const assert = require('assert');
const { authenticate } = require('../src/middleware/auth.middleware');

async function run() {
  let nextCalled = false;
  const req = {
    method: 'GET',
    headers: {
      authorization: 'Bearer should-not-be-used',
    },
    cookies: {},
    originalUrl: '/api/auth/profile',
    url: '/api/auth/profile',
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return body;
    },
  };

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.success, false);
  console.log('authMiddlewareCookieOnly.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
