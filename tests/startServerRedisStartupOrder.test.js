#!/usr/bin/env node
const assert = require('assert');

const startServerPath = require.resolve('../src/runtime/startServer');

const clearModule = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

(async () => {
  const calls = [];

  const mocks = {
    '../src/config/database.js': async () => { calls.push('connectDB'); },
    '../src/services/bootstrap.service.js': { runBootstrap: async () => { calls.push('runBootstrap'); } },
    '../src/config/config.js': { port: 5010, env: 'test' },
    '../src/utils/log.js': { info: () => {}, warn: () => {}, error: () => {} },
    '../src/services/notificationSocket.service.js': { initNotificationSocket: () => { calls.push('initSocket'); } },
    '../src/utils/pii.js': { sanitizeErrorForLog: (e) => ({ name: e?.name, message: e?.message, code: e?.code || null }) },
    '../src/config/redis.js': { getRedisClient: () => { calls.push('getRedisClient'); return null; }, isRedisReady: () => false, isRedisUrlConfigured: () => false },
    '../src/app/createApp.js': { createApp: () => ({ locals: {}, listen: (port, cb) => { calls.push('listen'); cb(); return { close: (done) => done && done() }; } }) },
  };

  Object.entries(mocks).forEach(([p, ex]) => {
    const full = require.resolve(p);
    require.cache[full] = { id: full, filename: full, loaded: true, exports: ex };
  });

  clearModule('../src/runtime/startServer.js');
  const { startServer } = require('../src/runtime/startServer.js');
  await startServer();

  const listenIdx = calls.indexOf('listen');
  assert.ok(calls.indexOf('connectDB') < listenIdx, 'connectDB must happen before listen');
  assert.ok(calls.indexOf('runBootstrap') < listenIdx, 'runBootstrap must happen before listen');
  assert.ok(calls.indexOf('getRedisClient') > listenIdx, 'getRedisClient should run after listen');

  console.log('startServerRedisStartupOrder test passed');
})();
