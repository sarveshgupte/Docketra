#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

let mongoosePingCount = 0;
let dateNowCount = 0;
let dateNowReturn = 1000;

function setupMocks() {
  const mocks = {
    mongoose: {
      connection: {
        db: {
          admin: () => ({
            ping: async () => {
              mongoosePingCount++;
              if (mocks.mongoose.connection.db._pingShouldThrow) {
                throw new Error('Ping failed');
              }
              return { ok: 1 };
            }
          })
        }
      }
    },
    './systemState.service': {
      getState: () => ({ state: 'ok', reasons: ['reason1', 'reason2'] })
    },
    './featureFlags.service': {
      isFirmCreationDisabled: () => false,
      isGoogleAuthDisabled: () => true,
      areFileUploadsDisabled: () => false
    },
    '../config/redis': {
      getRedisClient: () => ({
        status: 'ready',
        options: { lazyConnect: true }
      }),
      _clientIsNull: false
    },
    '../middleware/idempotency.middleware': {
      getIdempotencyCacheSize: () => 42
    },
    './metrics.service': {
      getSnapshot: async () => ({ requests: 100 }),
      getLatencyPercentiles: () => ({ p95: 50, p99: 100 })
    },
    './transactionMonitor.service': {
      getTransactionMetrics: () => ({ failed: 0 })
    },
    './sideEffectQueue.service': {
      getQueueDepth: () => 5,
      getFailed: () => 0
    },
    './circuitBreaker.service': {
      getSnapshot: () => ({ mongo: 'closed' }),
      isAnyOpen: () => false,
      recordSuccess: () => {},
      recordFailure: () => {}
    },
    './softDelete.service': {
      buildDiagnostics: async () => ({ orphans: 0 })
    }
  };

  // Special mock wrapper for redis to support null client
  const redisMock = mocks['../config/redis'];
  const originalGetRedisClient = redisMock.getRedisClient;
  redisMock.getRedisClient = () => {
    if (redisMock._clientIsNull) return null;
    return originalGetRedisClient();
  };

  for (const [modulePath, mockExports] of Object.entries(mocks)) {
    let fullPath;
    try {
      if (modulePath === 'mongoose') {
        fullPath = require.resolve('mongoose');
      } else {
        fullPath = require.resolve('../src/services/' + modulePath);
      }
      require.cache[fullPath] = {
        id: fullPath,
        filename: fullPath,
        loaded: true,
        exports: mockExports
      };
    } catch (e) {
      console.error('Error resolving', modulePath, e);
    }
  }

  return mocks;
}

function clearMocks() {
  const servicePath = require.resolve('../src/services/diagnostics.service.js');
  delete require.cache[servicePath];

  const mockPaths = [
    'mongoose',
    '../src/services/systemState.service',
    '../src/services/featureFlags.service',
    '../src/config/redis',
    '../src/middleware/idempotency.middleware',
    '../src/services/metrics.service',
    '../src/services/transactionMonitor.service',
    '../src/services/sideEffectQueue.service',
    '../src/services/circuitBreaker.service',
    '../src/services/softDelete.service'
  ];

  for (const p of mockPaths) {
    try {
      delete require.cache[require.resolve(p)];
    } catch(e) {}
  }
}

async function runTests() {
  let originalDateNow;

  try {
    console.log('Running diagnostics.service.test.js...');

    // Backup global
    originalDateNow = Date.now;

    // --- TEST 1: Happy path ---
    clearMocks();
    setupMocks();
    const servicePath = require.resolve('../src/services/diagnostics.service.js');
    let { getDiagnosticsSnapshot } = require(servicePath);

    Date.now = () => 1000;
    let snapshot = await getDiagnosticsSnapshot();

    assert.strictEqual(snapshot.systemState, 'ok');
    assert.deepStrictEqual(snapshot.degradedReasons, ['reason1', 'reason2']);
    assert.strictEqual(snapshot.redis.status, 'ready');
    assert.strictEqual(snapshot.redis.mode, 'lazy');
    assert.strictEqual(snapshot.redis.available, true);
    assert.strictEqual(snapshot.idempotencyCacheSize, 42);
    assert.deepStrictEqual(snapshot.sideEffectQueue, { depth: 5, failed: 0 });
    assert.strictEqual(snapshot.circuitOpen, false);

    let flags = snapshot.featureFlags;
    assert.strictEqual(flags.find(f => f.name === 'firmCreation').enabled, true);
    assert.strictEqual(flags.find(f => f.name === 'fileUploads').enabled, true);

    // measureDbLatency returns a number
    assert.strictEqual(typeof snapshot.dbLatencyMs, 'number');
    assert.strictEqual(snapshot.dbLatencyMs, 0);

    console.log('✅ Test 1 (Happy path) passed');

    // --- TEST 2: Caching behavior ---
    mongoosePingCount = 0;

    // Within TTL (30s = 30000ms), 1000 + 10000 = 11000
    Date.now = () => 11000;
    let snapshot2 = await getDiagnosticsSnapshot();

    assert.strictEqual(snapshot2, snapshot, 'Should return exactly the same object reference');
    assert.strictEqual(mongoosePingCount, 0, 'Should not have called ping again due to cache');

    // Outside TTL (1000 + 35000 = 36000)
    Date.now = () => 36000;
    let snapshot3 = await getDiagnosticsSnapshot();

    assert.notStrictEqual(snapshot3, snapshot, 'Should return a new object reference');
    assert.strictEqual(mongoosePingCount, 1, 'Should have called ping again since TTL expired');

    console.log('✅ Test 2 (Caching behavior) passed');


    // --- TEST 3: DB Latency Null when ping throws ---
    clearMocks();
    const mocks3 = setupMocks();
    mocks3.mongoose.connection.db._pingShouldThrow = true;
    let { getDiagnosticsSnapshot: getDiag3 } = require(servicePath);

    Date.now = () => 100000; // bypass any cache from global module scope if it was preserved (it shouldn't be since we cleared servicePath from cache)

    let snapshotWithDbFail = await getDiag3();
    assert.strictEqual(snapshotWithDbFail.dbLatencyMs, null, 'dbLatencyMs should be null if ping throws');
    console.log('✅ Test 3 (DB Ping failure) passed');


    // --- TEST 4: Redis Client Null ---
    clearMocks();
    const mocks4 = setupMocks();
    mocks4['../config/redis']._clientIsNull = true;
    let { getDiagnosticsSnapshot: getDiag4 } = require(servicePath);

    Date.now = () => 200000;
    let snapshotWithRedisFail = await getDiag4();
    assert.deepStrictEqual(snapshotWithRedisFail.redis, { available: false, status: 'unavailable' });
    console.log('✅ Test 4 (Redis client unavailable) passed');

    // Restore globals
    Date.now = originalDateNow;

    console.log('All tests passed!');

  } catch (err) {
    console.error('Test failed:', err);
    if (originalDateNow) Date.now = originalDateNow;
    process.exit(1);
  }
}

runTests();
