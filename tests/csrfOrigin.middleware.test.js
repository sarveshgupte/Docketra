const assert = require('assert');
const { enforceSameOriginForCookieAuth } = require('../src/middleware/csrfOrigin.middleware');

function createRes() {
  return {
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
}

function run() {
  let nextCalled = false;
  const sameOriginReq = {
    headers: {
      host: 'app.example.com',
      origin: 'https://app.example.com',
    },
  };
  const sameOriginRes = createRes();
  enforceSameOriginForCookieAuth(sameOriginReq, sameOriginRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);

  const noOriginReq = { headers: { host: 'app.example.com' } };
  const noOriginRes = createRes();
  enforceSameOriginForCookieAuth(noOriginReq, noOriginRes, () => {});
  assert.strictEqual(noOriginRes.statusCode, 200);

  const crossOriginReq = {
    headers: {
      host: 'app.example.com',
      origin: 'https://evil.example',
    },
  };
  const crossOriginRes = createRes();
  enforceSameOriginForCookieAuth(crossOriginReq, crossOriginRes, () => {});
  assert.strictEqual(crossOriginRes.statusCode, 403);
  assert.strictEqual(crossOriginRes.payload?.success, false);

  const refererReq = {
    headers: {
      host: 'app.example.com',
      referer: 'https://app.example.com/login',
    },
  };
  const refererRes = createRes();
  let refererNext = false;
  enforceSameOriginForCookieAuth(refererReq, refererRes, () => { refererNext = true; });
  assert.strictEqual(refererNext, true);

  console.log('csrfOrigin.middleware.test.js passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
