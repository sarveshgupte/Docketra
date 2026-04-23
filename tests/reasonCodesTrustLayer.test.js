#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { REASON_CODES } = require('../src/services/pilotDiagnostics.service');

const read = (relPath) => fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');

assert.strictEqual(REASON_CODES.MISSING_REFRESH_TOKEN, 'missing_refresh_token');
assert.strictEqual(REASON_CODES.AUTO_REOPEN_DUE, 'AUTO_REOPEN_DUE');
assert.strictEqual(REASON_CODES.STORAGE_EXPORT_FAILED, 'storage_export_failed');

const authSessionSource = read('src/services/authSession.service.js');
assert.ok(authSessionSource.includes('REASON_CODES.MISSING_REFRESH_TOKEN'), 'auth refresh should use shared missing refresh token reason code');
assert.ok(!authSessionSource.includes("reasonCode: 'missing_refresh_token'"), 'auth refresh should not hardcode missing_refresh_token reason code');

const workflowSource = read('src/services/docketWorkflow.service.js');
assert.ok(workflowSource.includes('REASON_CODES.AUTO_REOPEN_DUE'), 'reopen flow should use shared AUTO_REOPEN_DUE reason code');
assert.ok(!workflowSource.includes("reasonCode: 'AUTO_REOPEN_DUE'"), 'reopen flow should not hardcode AUTO_REOPEN_DUE reason code');

const storageControllerSource = read('src/controllers/storage.controller.js');
assert.ok(storageControllerSource.includes('reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED'), 'storage export failure should return structured reasonCode');
assert.ok(storageControllerSource.includes('reasonCode: REASON_CODES.EXPORT_DOWNLOAD_UNAVAILABLE'), 'export download availability should include structured reasonCode');

console.log('reasonCodesTrustLayer.test.js passed');

