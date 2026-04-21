const assert = require('assert');
const notificationSocketService = require('../src/services/notificationSocket.service');

function run() {
  const { getHandshakeToken } = notificationSocketService.__private;
  const token = getHandshakeToken({
    handshake: {
      headers: {
        cookie: 'theme=dark; accessToken=header.payload.signature; refreshToken=abc',
      },
    },
  });
  assert.strictEqual(token, 'header.payload.signature');

  const missing = getHandshakeToken({ handshake: { headers: {} } });
  assert.strictEqual(missing, null);
  console.log('notificationSocketCookieAuth.test.js passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
