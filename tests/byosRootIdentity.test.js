#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

process.env.GOOGLE_CLIENT_ID = 'cid';
process.env.GOOGLE_CLIENT_SECRET = 'secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5000/api/storage/google/callback';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.STORAGE_TOKEN_SECRET = 'test-storage-token-secret-32chars!!';

let mockDrive = null;
let firmDoc = null;
let updateCalls = [];
let folderGetThrows = false;
let manifestMissing = false;
let manifestMismatch = false;
let folderName = 'Renamed Folder';

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'googleapis') {
    return {
      google: {
        auth: { OAuth2: class { setCredentials() {} } },
        drive: () => mockDrive,
      },
    };
  }
  if (request.endsWith('/models/Firm.model') || request === '../models/Firm.model') {
    return {
      findById: () => ({ select: () => ({ lean: async () => firmDoc }) }),
      findByIdAndUpdate: async (_id, update) => { updateCalls.push(update); return {}; },
    };
  }
  if (request.includes('TokenEncryption.service')) {
    return {
      encrypt: (v) => `enc:${v}`,
      decrypt: (v) => String(v || '').replace(/^enc:/, ''),
    };
  }
  if (request === '../utils/role.utils') return { isAdminRole: () => true, isPrimaryAdminRole: () => true };
  if (request === '../utils/requestCookies') return { getCookieValue: () => null };
  if (request === '../services/storageBackup.service') return { storageBackupService: { listBackups: async () => [] } };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => ({}) } };
  if (request === '../services/storage/resolveFirmStorageState') return { normalizeProvider: (v) => v, resolveFirmStorageState: () => ({ canonicalProvider: 'google_drive', rootFolderId: 'root-1', credentials: { refreshToken: 'r' } }) };
  if (request === '../services/storage/providers/GoogleDriveProvider') return class { constructor(){ } getClient(){ return mockDrive; } };
  if (request === '../services/storage/providers/OneDriveProvider') return class {};
  if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => ({}) };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'firm-1' }) };
  if (request === 'bullmq') return { Queue: class {}, Worker: class { on() {} } };
  return originalLoad.apply(this, arguments);
};

function setupDrive() {
  let createCount = 0;
  mockDrive = {
    files: {
      get: async (opts) => {
        if (opts.alt === 'media') {
          const manifest = manifestMismatch
            ? { docketraStorageRoot: true, firmId: 'other-firm', rootFolderId: 'root-1' }
            : { docketraStorageRoot: true, firmId: 'firm-1', rootFolderId: 'root-1' };
          const { Readable } = require('stream');
          return { data: Readable.from([JSON.stringify(manifest)]) };
        }
        if (folderGetThrows) throw new Error('not found');
        return { data: { id: opts.fileId, name: folderName, trashed: false } };
      },
      list: async (opts) => {
        if (String(opts.q || '').includes('.docketra-storage-root.json')) {
          return { data: { files: manifestMissing ? [] : [{ id: 'manifest-1' }] } };
        }
        return { data: { files: [] } };
      },
      create: async () => { createCount += 1; return { data: { id: createCount === 1 ? 'root-new' : 'manifest-1' } }; },
      update: async () => ({}),
    },
    about: { get: async () => ({ data: { user: { emailAddress: 'admin@example.com' } } }) },
  };
  return () => createCount;
}

async function run() {
  const { googleDriveService } = require('../src/services/googleDrive.service');
  const controller = require('../src/controllers/storage.controller');

  // reuse existing valid root and avoid duplicate root creation
  firmDoc = { _id: 'firm-1', slug: 'firm-one', storage: { google: { rootFolderId: 'root-1' } }, storageConfig: { credentials: 'enc:'+JSON.stringify({ refreshToken: 'old', rootFolderId: 'root-1' }) } };
  folderGetThrows = false; manifestMissing = false; manifestMismatch = false;
  const getCreateCount1 = setupDrive();
  const saved = await googleDriveService.saveUserDriveConnection({ firmId: 'firm-1', tokens: { refresh_token: 'new-refresh' } });
  assert.strictEqual(saved.rootFolderId, 'root-1');
  assert.strictEqual(getCreateCount1(), 0, 'should only create/update manifest, not new root folder');
  console.log('  ✓ saveUserDriveConnection reuses existing valid rootFolderId');
  console.log('  ✓ saveUserDriveConnection does not create duplicate root when valid root exists');

  // missing/deleted root
  folderGetThrows = true; manifestMissing = false; manifestMismatch = false;
  setupDrive();
  await assert.rejects(() => googleDriveService.saveUserDriveConnection({ firmId: 'firm-1', tokens: { refresh_token: 'new' } }), (err) => err.code === 'STORAGE_ROOT_MISSING');
  console.log('  ✓ missing/deleted root returns STORAGE_ROOT_MISSING');

  // manifest missing
  folderGetThrows = false; manifestMissing = true; manifestMismatch = false;
  setupDrive();
  await assert.rejects(() => googleDriveService.saveUserDriveConnection({ firmId: 'firm-1', tokens: { refresh_token: 'new' } }), (err) => err.code === 'STORAGE_MANIFEST_MISSING');
  console.log('  ✓ manifest missing returns STORAGE_MANIFEST_MISSING');

  // manifest mismatch
  folderGetThrows = false; manifestMissing = false; manifestMismatch = true;
  setupDrive();
  await assert.rejects(() => googleDriveService.saveUserDriveConnection({ firmId: 'firm-1', tokens: { refresh_token: 'new' } }), (err) => err.code === 'STORAGE_ROOT_MISMATCH');
  console.log('  ✓ manifest mismatch returns STORAGE_ROOT_MISMATCH');

  // rename tolerated
  folderName = 'Renamed But Valid'; folderGetThrows = false; manifestMissing = false; manifestMismatch = false;
  setupDrive();
  const drive = mockDrive;
  const result = await googleDriveService.validateRootFolder({ drive, firm: { _id: 'firm-1' }, rootFolderId: 'root-1' });
  assert.strictEqual(result.valid, true);
  console.log('  ✓ folder rename is tolerated when folderId + manifest match');

  // folder-link recovery required + sanitized
  const req = { user: { role: 'PRIMARY_ADMIN' }, firmId: 'firm-1', ownershipFirmId: 'firm-1', requestId: 'r1' };
  const res = { statusCode: 200, body: null, status(c){ this.statusCode=c; return this; }, json(p){ this.body=p; return this; } };
  manifestMissing = true;
  setupDrive();
  await controller.getStorageFolderLink(req, res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, 'storage_recovery_required');
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes('refreshToken') && !serialized.includes('accessToken') && !serialized.includes('privateKey') && !serialized.includes('clientSecret'));
  console.log('  ✓ folder-link endpoint returns storage_recovery_required for invalid root');
  console.log('  ✓ no response exposes refreshToken/accessToken/privateKey/clientSecret');

  Module._load = originalLoad;
  console.log('byosRootIdentity.test.js passed');
}

run().catch((err) => { Module._load = originalLoad; console.error(err); process.exit(1); });
