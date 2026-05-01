#!/usr/bin/env node
const assert = require('assert');

const clearModule = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

(async () => {
  const logs = [];

  const error = new TypeError('Failed to fetch https://api.example.com/bootstrap?token=super-secret-token');
  error.code = 'BOOTSTRAP_TYPE_ERROR';
  error.stack = [
    'TypeError: Failed to fetch https://api.example.com/bootstrap?token=super-secret-token',
    '    at runBootstrap (https://api.example.com/bootstrap.js:12:3)',
    '    at startServer (https://api.example.com/server.js:45:10)',
    '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    '    at next (https://api.example.com/next.js:10:1)',
    '    at final (https://api.example.com/final.js:99:9)',
  ].join('\n');

  const mocks = {
    '../src/config/database.js': async () => {},
    '../src/services/bootstrap.service.js': { runBootstrap: async () => { throw error; } },
    '../src/config/config.js': { port: 5010, env: 'test' },
    '../src/utils/log.js': {
      info: () => {},
      warn: () => {},
      error: (event, meta) => logs.push({ event, meta }),
    },
    '../src/services/notificationSocket.service.js': { initNotificationSocket: () => {} },
    '../src/config/redis.js': { getRedisClient: () => null, isRedisReady: () => false, isRedisUrlConfigured: () => false },
    '../src/app/createApp.js': { createApp: () => ({ locals: {}, listen: () => ({ close: () => {} }) }) },
  };

  Object.entries(mocks).forEach(([p, ex]) => {
    const full = require.resolve(p);
    require.cache[full] = { id: full, filename: full, loaded: true, exports: ex };
  });

  clearModule('../src/runtime/startServer.js');
  const { startServer, buildStartupErrorDetails } = require('../src/runtime/startServer.js');

  let failed = false;
  try {
    await startServer();
  } catch (err) {
    failed = true;
    const details = buildStartupErrorDetails(err);
    assert.strictEqual(details.name, 'TypeError');
    assert.strictEqual(details.code, 'BOOTSTRAP_TYPE_ERROR');
    assert.ok(details.message.includes('https://api.example.com/bootstrap?token=[REDACTED]'));
    assert.ok(!/^\[REDACTED_URL\]$/.test(details.message));
    assert.ok(Array.isArray(details.stackFrames));
    assert.ok(details.stackFrames.length <= 6);
    assert.ok(details.stackFrames.join('\n').includes('token=[REDACTED]'));
  }

  assert.ok(failed, 'startServer should fail when bootstrap throws');

  console.log('startupFailureLogging.test.js passed');
})();
