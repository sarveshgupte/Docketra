#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  let savedFirmId = null;
  let markCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ tenantId: 'tenant-canonical', ownershipFirmId: 'firm-owner-77' }) };
    if (request === '../services/googleDrive.service') {
      return {
        googleDriveService: {
          getOAuthClient: () => ({
            generateAuthUrl: ({ state }) => `https://oauth.test?state=${encodeURIComponent(state)}`,
            getToken: async () => ({ tokens: { refresh_token: 'r1' } }),
          }),
          saveUserDriveConnection: async ({ firmId }) => { savedFirmId = firmId; return { rootFolderId: 'root-1' }; },
          getClient: async () => { throw new Error('upstream failed'); },
          markStorageDisconnected: async () => { markCalled = true; },
          markStorageError: async () => { markCalled = true; },
          listFiles: async () => { throw new Error('usage secret'); },
        },
        PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' },
      };
    }
    if (request === '../models/Firm.model') return { findById: () => ({ select(){return this;}, lean: async()=>({ storageConfig: null, storage: {} }) }), findByIdAndUpdate: async()=>({}) };
    if (request.includes('TokenEncryption.service')) return { encrypt: (v)=>v, decrypt: ()=> '{}' };
    if (request === '../services/storageBackup.service') return { storageBackupService: { runBackupForFirm: async ()=> { throw new Error('backup secret'); }, listBackups: async()=> { throw new Error('list secret'); } } };
    if (request === '../services/storage/providers/GoogleDriveProvider') return function G() {};
    if (request === '../services/storage/providers/OneDriveProvider') return function O() {};
    if (request === '../services/storage/errors/StorageErrors') return { StorageValidationError: class extends Error {} };
    if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
    if (request === '../services/storageAdapter.service') return { S3Adapter: function() {} };
    if (request === '../services/productAudit.service') return { writeSettingsAudit: async ()=>{} };
    if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: { STORAGE_EXPORT_FAILED: 'x', BACKUP_RUNS_FETCH_FAILED: 'y' }, logPilotEvent: ()=>{} };
    if (request === '../utils/requestCookies') return { getCookieValue: () => null };
    if (request === '../utils/log') return { error: ()=>{}, warn: ()=>{}, info: ()=>{} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/storage.controller');
  const ctl = require('../src/controllers/storage.controller');

  const reqConnect = { firmId: 'tenant-canonical', user: { role: 'PRIMARY_ADMIN' } };
  const resConnect = { headers: {}, redirected: null, setHeader(k,v){this.headers[k]=v;}, redirect(u){this.redirected=u; return this;}, status(){return this;}, json(){return this;} };
  ctl.googleConnect(reqConnect, resConnect);
  const stateCookie = String(resConnect.headers['Set-Cookie'] || '').split(';')[0].replace('storage_oauth_state=', '');

  const reqCb = { firmId: 'tenant-canonical', user: { role: 'PRIMARY_ADMIN' }, query: { code: 'abc', state: stateCookie }, headers: { cookie: `storage_oauth_state=${stateCookie}` }, cookies: { storage_oauth_state: stateCookie } };
  const resCb = { code: 200, headers: {}, redirected: null, status(c){this.code=c; return this;}, json(p){this.payload=p; return this;}, setHeader(k,v){this.headers[k]=v;}, redirect(u){this.redirected=u; return this;} };
  await ctl.googleCallback(reqCb, resCb);
  assert.strictEqual(savedFirmId, 'firm-owner-77');

  const reqHealth = { firmId: 'tenant-canonical', user: { role: 'PRIMARY_ADMIN' } };
  const resHealth = { code: 200, payload: null, status(c){this.code=c; return this;}, json(p){this.payload=p; return this;} };
  await ctl.storageHealthCheck(reqHealth, resHealth);
  assert.strictEqual(resHealth.code, 502);
  assert.strictEqual(Boolean(markCalled), true);

  const resUsage = { code: 200, payload: null, status(c){this.code=c; return this;}, json(p){this.payload=p; return this;} };
  await ctl.storageUsage(reqHealth, resUsage);
  assert.strictEqual(resUsage.code, 500);
  assert.strictEqual(Boolean(resUsage.payload.message), false);

  process.env.NODE_ENV = prevEnv;
  console.log('storageOAuthAndErrorSanitization.test.js passed');
}
run().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>{ Module._load = originalLoad; });
