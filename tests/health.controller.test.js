#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

let mockState = 'NORMAL';
let mockMongooseReadyState = 1;
let mockRedisStatus = 'ready';
let mockEnvValid = true;
let mockPingLatencyMs = 10;
let mockPingShouldThrow = false;
let mockWorkerStatuses = {
  storage: { status: 'running' },
  email: { status: 'running' },
  audit: { status: 'running' }
};
let markedDegraded = [];

function setupMocks() {
  const mocks = {
    mongoose: {
      connection: {
        get readyState() { return mockMongooseReadyState; },
        db: {
          admin: () => ({
            ping: async () => {
              if (mockPingShouldThrow) throw new Error('DB Ping Failed');
              const start = Date.now();
              while (Date.now() - start < mockPingLatencyMs) {
                // busy wait to simulate latency
              }
              return { ok: 1 };
            }
          })
        }
      }
    },
    '../models/Firm.model': {
      estimatedDocumentCount: async () => 10
    },
    '../models/User.model': {
      estimatedDocumentCount: async () => 20
    },
    '../config/validateEnv': {
      validateEnv: () => ({ valid: mockEnvValid, errors: mockEnvValid ? [] : ['ENV_ERROR'] })
    },
    '../config/redis': {
      getRedisClient: () => {
        if (mockRedisStatus === 'null') return null;
        if (mockRedisStatus === 'throw') throw new Error('Redis Error');
        return { status: mockRedisStatus };
      }
    },
    '../services/buildInfo.service': {
      getBuildMetadata: () => ({ version: '1.0.0', commit: 'abcdef', buildTimestamp: '2023-01-01T00:00:00Z' })
    },
    '../services/systemState.service': {
      STATES: { NORMAL: 'NORMAL', DEGRADED: 'DEGRADED', EMERGENCY: 'EMERGENCY' },
      markDegraded: (reason, data) => { markedDegraded.push({ reason, data }); },
      getState: () => ({ state: mockState, reasons: markedDegraded.map(m => m.reason) }),
      setState: (s) => { mockState = s; }
    },
    '../services/featureGate.service': {
      isFirmCreationDisabled: () => false,
      isGoogleAuthDisabled: () => true,
      areFileUploadsDisabled: () => false
    },
    '../services/workerRegistry.service': {
      getWorkerStatuses: () => mockWorkerStatuses
    }
  };

  for (const [modulePath, mockExports] of Object.entries(mocks)) {
    let fullPath;
    if (modulePath === 'mongoose') {
      fullPath = require.resolve('mongoose');
    } else {
      fullPath = require.resolve('../src/controllers/' + modulePath);
    }
    require.cache[fullPath] = {
      id: fullPath,
      filename: fullPath,
      loaded: true,
      exports: mockExports
    };
  }
}

function clearMocks() {
  const servicePath = require.resolve('../src/controllers/health.controller.js');
  delete require.cache[servicePath];

  const mockPaths = [
    'mongoose',
    '../src/models/Firm.model',
    '../src/models/User.model',
    '../src/config/validateEnv',
    '../src/config/redis',
    '../src/services/buildInfo.service',
    '../src/services/systemState.service',
    '../src/services/featureGate.service',
    '../src/services/workerRegistry.service'
  ];

  for (const p of mockPaths) {
    try {
      delete require.cache[require.resolve(p)];
    } catch(e) {}
  }

  mockState = 'NORMAL';
  mockMongooseReadyState = 1;
  mockRedisStatus = 'ready';
  mockEnvValid = true;
  mockPingLatencyMs = 10;
  mockPingShouldThrow = false;
  mockWorkerStatuses = {
    storage: { status: 'running' },
    email: { status: 'running' },
    audit: { status: 'running' }
  };
  markedDegraded = [];
}

async function runTests() {
  try {
    console.log('Running health.controller.test.js...');

    // Set process env
    process.env.REDIS_URL = 'redis://localhost:6379';

    // --- TEST 1: liveness ---
    clearMocks();
    setupMocks();
    const { liveness } = require('../src/controllers/health.controller.js');
    let resJsonCalled = false;
    let resObj = null;
    const res = {
      json: (data) => {
        resJsonCalled = true;
        resObj = data;
      }
    };
    liveness({}, res);
    assert.strictEqual(resJsonCalled, true);
    assert.strictEqual(resObj.status, 'ok');
    assert.ok(resObj.timestamp);
    console.log('✅ liveness passed');


    // --- TEST 2: runReadinessChecks (Happy Path) ---
    clearMocks();
    setupMocks();
    const { runReadinessChecks } = require('../src/controllers/health.controller.js');
    let checksResult = await runReadinessChecks();
    assert.strictEqual(checksResult.ready, true);
    assert.strictEqual(checksResult.checks.db, 'ok');
    assert.strictEqual(checksResult.checks.redis, 'ready');
    assert.strictEqual(checksResult.checks.env, 'ok');
    assert.strictEqual(mockState, 'NORMAL');
    assert.strictEqual(markedDegraded.length, 0);
    console.log('✅ runReadinessChecks (Happy Path) passed');


    // --- TEST 3: runReadinessChecks (Degraded DB Latency) ---
    clearMocks();
    mockPingLatencyMs = 800; // Above 750 threshold
    setupMocks();
    const { runReadinessChecks: runReadinessChecksDbSlow } = require('../src/controllers/health.controller.js');
    let checksResultDbSlow = await runReadinessChecksDbSlow();
    assert.strictEqual(checksResultDbSlow.checks.db, 'degraded');
    assert.strictEqual(checksResultDbSlow.ready, false); // ready is true only if dbStatusOk
    assert.ok(markedDegraded.some(m => m.reason === 'db_slow'));
    console.log('✅ runReadinessChecks (Degraded DB Latency) passed');


    // --- TEST 4: runReadinessChecks (DB Error) ---
    clearMocks();
    mockPingShouldThrow = true;
    setupMocks();
    const { runReadinessChecks: runReadinessChecksDbErr } = require('../src/controllers/health.controller.js');
    let checksResultDbErr = await runReadinessChecksDbErr();
    assert.strictEqual(checksResultDbErr.checks.db, 'error');
    assert.strictEqual(checksResultDbErr.ready, false);
    assert.ok(markedDegraded.some(m => m.reason === 'db_error'));
    console.log('✅ runReadinessChecks (DB Error) passed');


    // --- TEST 5: runReadinessChecks (Redis null) ---
    clearMocks();
    mockRedisStatus = 'null';
    setupMocks();
    const { runReadinessChecks: runReadinessChecksRedisNull } = require('../src/controllers/health.controller.js');
    let checksResultRedisNull = await runReadinessChecksRedisNull();
    assert.strictEqual(checksResultRedisNull.checks.redis, 'not_configured');
    assert.strictEqual(checksResultRedisNull.ready, true); // not_configured is ok for ready
    console.log('✅ runReadinessChecks (Redis null) passed');


    // --- TEST 6: runReadinessChecks (Invalid Env) ---
    clearMocks();
    mockEnvValid = false;
    setupMocks();
    const { runReadinessChecks: runReadinessChecksEnvErr } = require('../src/controllers/health.controller.js');
    let checksResultEnvErr = await runReadinessChecksEnvErr();
    assert.strictEqual(checksResultEnvErr.checks.env, 'failed');
    assert.strictEqual(checksResultEnvErr.ready, false);
    assert.ok(markedDegraded.some(m => m.reason === 'env_invalid'));
    console.log('✅ runReadinessChecks (Invalid Env) passed');


    // --- TEST 7: readiness (Happy Path) ---
    clearMocks();
    setupMocks();
    const { readiness } = require('../src/controllers/health.controller.js');
    let resStatusVal = 200;
    let resJsonVal = null;
    const resReadiness = {
      status: (code) => { resStatusVal = code; return resReadiness; },
      json: (data) => { resJsonVal = data; }
    };
    await readiness({}, resReadiness);
    assert.strictEqual(resStatusVal, 200);
    assert.strictEqual(resJsonVal.status, 'ready');
    console.log('✅ readiness (Happy Path) passed');


    // --- TEST 8: readiness (Degraded) ---
    clearMocks();
    mockMongooseReadyState = 0;
    mockState = 'DEGRADED';
    setupMocks();
    const { readiness: readinessDegraded } = require('../src/controllers/health.controller.js');
    let resStatusVal2 = 200;
    let resJsonVal2 = null;
    const resReadiness2 = {
      status: (code) => { resStatusVal2 = code; return resReadiness2; },
      json: (data) => { resJsonVal2 = data; }
    };
    await readinessDegraded({}, resReadiness2);
    assert.strictEqual(resStatusVal2, 503);
    assert.strictEqual(resJsonVal2.status, 'degraded');
    console.log('✅ readiness (Degraded) passed');


    // --- TEST 9: apiHealth (Happy Path) ---
    clearMocks();
    setupMocks();
    const { apiHealth } = require('../src/controllers/health.controller.js');
    let resStatusVal3 = 200;
    let resJsonVal3 = null;
    const resApiHealth = {
      status: (code) => { resStatusVal3 = code; return resApiHealth; },
      json: (data) => { resJsonVal3 = data; }
    };
    await apiHealth({}, resApiHealth);
    assert.strictEqual(resJsonVal3.status, 'healthy');
    assert.strictEqual(resJsonVal3.mongo, 'connected');
    assert.strictEqual(resJsonVal3.redis, 'connected');
    assert.strictEqual(resJsonVal3.workers, 'running');
    console.log('✅ apiHealth (Happy Path) passed');


    // --- TEST 10: apiHealth (Worker degraded) ---
    clearMocks();
    mockWorkerStatuses.audit.status = 'failed';
    setupMocks();
    const { apiHealth: apiHealthWorkerErr } = require('../src/controllers/health.controller.js');
    let resStatusVal4 = 200;
    let resJsonVal4 = null;
    const resApiHealth2 = {
      status: (code) => { resStatusVal4 = code; return resApiHealth2; },
      json: (data) => { resJsonVal4 = data; }
    };
    await apiHealthWorkerErr({}, resApiHealth2);
    assert.strictEqual(resJsonVal4.status, 'degraded');
    assert.strictEqual(resJsonVal4.workers, 'degraded');
    console.log('✅ apiHealth (Worker degraded) passed');

    // --- TEST 11: apiHealth (Redis throw) ---
    clearMocks();
    mockRedisStatus = 'throw';
    setupMocks();
    const { apiHealth: apiHealthRedisThrow } = require('../src/controllers/health.controller.js');
    let resStatusVal5 = 200;
    let resJsonVal5 = null;
    const resApiHealth3 = {
      status: (code) => { resStatusVal5 = code; return resApiHealth3; },
      json: (data) => { resJsonVal5 = data; }
    };
    await apiHealthRedisThrow({}, resApiHealth3);
    assert.strictEqual(resJsonVal5.status, 'degraded');
    assert.strictEqual(resJsonVal5.redis, 'disconnected');
    console.log('✅ apiHealth (Redis throw) passed');


    console.log('All tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
