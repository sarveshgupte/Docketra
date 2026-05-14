#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let role = 'Primary Admin';

function createRes() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
}

const originalLoad = Module._load;
Module._load = function mockLoad(request, parent, isMain) {
  if (request === '../models/Firm.model') return { findById: () => ({ select: () => ({ lean: async () => ({ storage: { mode: 'firm_connected', provider: 'google_drive' }, storageConfig: { credentials: '{}' }, slug: 'alpha' }) }) }) };
  if (request === '../utils/role.utils') return { isAdminRole: () => role !== 'User', isPrimaryAdminRole: () => true };
  if (request === '../services/storage/services/TokenEncryption.service') return { encrypt: (v) => v, decrypt: () => JSON.stringify({ connectedEmail: 'admin@firm.com', lastCheckedAt: '2026-05-10T00:00:00.000Z' }) };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => ({ getStorageQuota: async () => ({ quotaAvailable: true, displayUsed: '1 GB', displayTotal: '10 GB', usagePercent: 10 }) }) } };
  if (request === '../services/storage/resolveFirmStorageState') return { resolveFirmStorageState: () => ({ isManaged: false, canonicalProvider: 'google_drive', connectionStatus: 'ACTIVE_BYOS' }), normalizeProvider: (v) => v };
  if (request === '../services/googleDrive.service') return { googleDriveService: { getOAuthClient: () => ({}) }, PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' } };
  if (request.includes('providers/') || request.includes('pilotDiagnostics') || request.includes('productAudit') || request === '../services/storageBackup.service') return {};
  if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'firm-1' }) };
  if (request === '../utils/requestCookies') return { getCookieValue: () => '' };
  if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: () => {} };
  return originalLoad(request, parent, isMain);
};

const controller = require('../src/controllers/storage.controller');

(async () => {
  role = 'User';
  let req = { firmId: 'firm-1', user: { role } };
  let res = createRes();
  await controller.getStorageDataMap(req, res);
  assert.equal(res.statusCode, 403);

  role = 'Admin';
  req = { firmId: 'firm-1', user: { role } };
  res = createRes();
  await controller.getStorageDataMap(req, res);
  assert.equal(res.statusCode, 200);
  const body = JSON.stringify(res.body);
  assert.ok(body.includes('Data Storage Map'));
  assert.ok(!body.includes('refreshToken'));
  assert.ok(!body.includes('privateKey'));
  assert.ok(!body.includes('rootFolderId'));
  assert.ok(!body.includes('driveId'));
  console.log('storageDataMap.controller.test.js passed');
  Module._load = originalLoad;
})();
