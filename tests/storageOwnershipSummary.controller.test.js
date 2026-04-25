#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let isAdmin = true;
let capturedFirmId = null;
let backupLookupFirmId = null;

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const originalLoad = Module._load;
Module._load = function mockLoad(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      findById: (firmId) => {
        capturedFirmId = String(firmId);
        return {
          select: () => ({
            lean: async () => ({
              storage: { mode: 'docketra_managed', provider: 'docketra_managed' },
              storageConfig: null,
              settings: { storageBackup: { enabled: true, retentionDays: 30 } },
            }),
          }),
        };
      },
    };
  }
  if (request === '../services/storageBackup.service') {
    return {
      storageBackupService: {
        listBackups: async (firmId) => {
          backupLookupFirmId = String(firmId);
          return [{ exportId: 'exp-1', createdAt: '2026-04-20T10:00:00.000Z', fileCount: 3, size: 1000 }];
        },
      },
    };
  }
  if (request === '../utils/role.utils') {
    return {
      isAdminRole: () => isAdmin,
      isPrimaryAdminRole: () => true,
    };
  }
  if (request === '../services/storage/services/TokenEncryption.service') {
    return { encrypt: (v) => v, decrypt: () => '{}' };
  }
  if (request === '../services/googleDrive.service') {
    return {
      googleDriveService: { getOAuthClient: () => ({}) },
      PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' },
    };
  }
  if (request === '../services/storage/providers/GoogleDriveProvider') return class {};
  if (request === '../services/storage/providers/OneDriveProvider') return class {};
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
  if (request === '../services/storageAdapter.service') return { S3Adapter: class {} };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {} };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === '../utils/requestCookies') return { getCookieValue: () => '' };
  if (request === '../utils/log') return { info: () => {}, error: () => {}, warn: () => {} };
  return originalLoad(request, parent, isMain);
};

const controller = require('../src/controllers/storage.controller');

async function testAdminPermission() {
  isAdmin = false;
  const req = { firmId: 'firm-alpha', user: { role: 'User' } };
  const res = createRes();
  await controller.getStorageOwnershipSummary(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.error, 'Only firm admin can manage storage connection');
  console.log('  ✓ storage ownership summary requires admin access');
}

async function testTenantIsolation() {
  isAdmin = true;
  capturedFirmId = null;
  backupLookupFirmId = null;
  const req = { firmId: 'firm-tenant-a', user: { role: 'Primary Admin' } };
  const res = createRes();
  await controller.getStorageOwnershipSummary(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(capturedFirmId, 'firm-tenant-a');
  assert.strictEqual(backupLookupFirmId, 'firm-tenant-a');
  assert.ok(Array.isArray(res.body.warnings));
  console.log('  ✓ storage ownership summary scopes reads to req.firmId');
}

async function run() {
  console.log('Running storage ownership summary controller tests...');
  try {
    await testAdminPermission();
    await testTenantIsolation();
    console.log('All storage ownership summary controller tests passed.');
  } catch (error) {
    console.error('storage ownership summary controller tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
