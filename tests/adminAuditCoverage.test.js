#!/usr/bin/env node
const assert = require('assert');
const EventEmitter = require('events');

const { adminAuditTrail } = require('../src/middleware/adminAudit.middleware');
const { getBufferedAudits, resetAuditBuffer } = require('../src/services/adminAudit.service');

const buildRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = () => res;
  // align with Express response API
  res.once = res.once.bind(res);
  res.on = res.on.bind(res);
  return res;
};

const runAuditCapture = async (method) => {
  resetAuditBuffer();
  const middleware = adminAuditTrail('admin');
  const req = {
    method,
    originalUrl: '/api/admin/example/CASE123',
    params: { id: 'CASE123' },
    user: { xID: 'XTEST01', firmId: 'FIRM001', _id: '507f1f77bcf86cd799439011' },
    headers: { 'user-agent': 'audit-test' },
    requestId: 'req-audit-1',
    ip: '127.0.0.1',
    firm: { id: 'FIRM001' },
  };
  const res = buildRes();
  await middleware(req, res, () => {});
  res.emit('finish');
  return getBufferedAudits();
};

async function shouldLogMutations() {
  const audits = await runAuditCapture('POST');
  assert.strictEqual(audits.length, 1, 'Mutating admin requests must emit an audit entry');
  assert.strictEqual(audits[0].target, 'CASE123');
  console.log('✓ Admin mutation emits audit entry with target');
}

async function shouldSkipReads() {
  const audits = await runAuditCapture('GET');
  assert.strictEqual(audits.length, 0, 'Read-only admin requests should not emit audit entries');
  console.log('✓ Read-only admin request does not emit audit entry');
}

async function run() {
  await shouldLogMutations();
  await shouldSkipReads();
  console.log('\nAdmin audit coverage tests completed.');
}

run().catch((err) => {
  console.error('Admin audit coverage test failed:', err);
  process.exit(1);
});
