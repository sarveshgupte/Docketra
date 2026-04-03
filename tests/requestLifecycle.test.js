#!/usr/bin/env node
const assert = require('assert');
const EventEmitter = require('events');
const lifecycle = require('../src/middleware/requestLifecycle.middleware');
const log = require('../src/utils/log');
const { reset: resetQueue } = require('../src/services/sideEffectQueue.service');

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
  }

  setHeader(key, value) {
    this.headers[key] = value;
  }
}

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

async function testLifecycleLogsOnce() {
  resetQueue();
  const logs = [];
  const originalInfo = log.info;
  log.info = (event, meta) => logs.push({ event, meta });

  const req = {
    method: 'GET',
    originalUrl: '/test',
    user: { xID: 'X1', role: 'Admin' },
    firmId: 'FIRM123',
  };
  const res = new MockResponse();

  lifecycle(req, res, () => {});
  res.emit('finish');
  res.emit('close');
  await flushAsync();

  log.info = originalInfo;

  const lifecycleLogs = logs.filter((l) => l.event === 'REQUEST_LIFECYCLE');
  assert.strictEqual(lifecycleLogs.length, 1, 'Lifecycle log should fire exactly once');
  assert.strictEqual(typeof res.headers['X-Request-ID'], 'string');
  assert.strictEqual(lifecycleLogs[0].meta.transactionCommitted, false);
}

async function testLoginSkipsSideEffects() {
  resetQueue();
  const req = {
    method: 'POST',
    originalUrl: '/auth/login',
    user: null,
    firmId: null,
  };
  const logs = [];
  const originalInfo = log.info;
  log.info = (event, meta) => logs.push({ event, meta });
  const res = new MockResponse();

  lifecycle(req, res, () => {});
  res.emit('finish');
  res.emit('close');
  await flushAsync();

  log.info = originalInfo;

  const lifecycleLogs = logs.filter((l) => l.event === 'REQUEST_LIFECYCLE');
  assert.strictEqual(lifecycleLogs.length, 1, 'Lifecycle log should still be recorded');
  assert.strictEqual(lifecycleLogs[0].meta.transactionCommitted, false);
}

async function testLifecycleWaitsForTransactionFinalization() {
  resetQueue();
  const logs = [];
  const originalInfo = log.info;
  log.info = (event, meta) => logs.push({ event, meta });

  let resolveTransaction;
  const req = {
    method: 'POST',
    originalUrl: '/api/cases',
    transactionCommitted: false,
    transactionState: 'started',
    transactionFinalized: new Promise((resolve) => {
      resolveTransaction = resolve;
    }),
  };
  const res = new MockResponse();

  lifecycle(req, res, () => {});
  res.emit('finish');
  await flushAsync();
  assert.strictEqual(logs.filter((l) => l.event === 'REQUEST_LIFECYCLE').length, 0, 'Lifecycle should wait for transaction finalization');

  req.transactionCommitted = true;
  req.transactionState = 'committed';
  resolveTransaction();
  await flushAsync();

  log.info = originalInfo;

  const lifecycleLogs = logs.filter((l) => l.event === 'REQUEST_LIFECYCLE');
  assert.strictEqual(lifecycleLogs.length, 1, 'Lifecycle log should fire exactly once');
  assert.strictEqual(lifecycleLogs[0].meta.transactionCommitted, true, 'Lifecycle should capture final commit flag');
  assert.strictEqual(lifecycleLogs[0].meta.transactionState, 'committed', 'Lifecycle should capture final transaction state');
}

async function run() {
  try {
    await testLifecycleLogsOnce();
    await testLoginSkipsSideEffects();
    await testLifecycleWaitsForTransactionFinalization();
    console.log('Request lifecycle tests passed.');
  } catch (err) {
    console.error('Request lifecycle tests failed:', err);
    process.exit(1);
  }
}

run();
