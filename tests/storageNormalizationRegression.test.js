const assert = require('assert');
const Module = require('module');
const { decrypt } = require('../src/services/storage/services/TokenEncryption.service');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(64);
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'test-storage-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost/api/storage/google/callback';
process.env.FRONTEND_URL = 'http://localhost';

const originalLoad = Module._load;

(async function run() {
  const state = { firm: null, s3Tested: false, updates: [], jti: 0 };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model' || request.endsWith('/models/Firm.model')) {
      return {
        findById: () => ({ select: () => ({ lean: async () => state.firm }) }),
        findByIdAndUpdate: async (_id, update) => { state.updates.push(update); return {}; },
      };
    }
    if (request === '../services/storage/StorageProviderFactory') {
      return { StorageProviderFactory: { getProvider: async () => ({ providerName: 'docketra_managed', testConnection: async () => {} }) } };
    }
    if (request === '../services/storage/providers/S3Provider') {
      return {
        S3Provider: class {
          constructor(cfg) { this.cfg = cfg; }
          async testConnection() {
            state.s3Tested = true;
            assert.strictEqual(this.cfg.tenantId, 'F1');
            assert.strictEqual(this.cfg.bucket, 'b');
            assert.strictEqual(this.cfg.region, 'r');
            assert.strictEqual(this.cfg.credentials.accessKeyId, 'ak');
            assert.strictEqual(this.cfg.credentials.secretAccessKey, 'sk');
          }
        },
      };
    }
    if (request === 'jsonwebtoken') {
      return { verify: () => ({ type: 'otp_verification', purpose: 'storage_change', jti: String(++state.jti), identifier: 'admin@example.com', exp: Math.floor(Date.now() / 1000) + 300 }) };
    }
    if (request === '../utils/log') return { warn: () => {}, error: () => {}, info: () => {} };
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'F1' }) };
    if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {} };
    return originalLoad(request, parent, isMain);
  };

  const middleware = require('../src/middleware/requireStorageConnected');
  assert.strictEqual(middleware.requireStorageConnected, middleware.requireActiveStorageProvider);

  const req = { firmId: 'F1' };
  let statusCode = null; let body = null;
  const res = { status: (c) => { statusCode = c; return { json: (b) => { body = b; } }; } };
  await middleware.requireActiveStorageProvider(req, res, () => {});
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(body.code, 'STORAGE_NOT_CONNECTED');
  assert.strictEqual(body.message, 'Active storage provider is not available');

  state.firm = { storage: { mode: 'firm_connected', provider: 'google_drive' }, storageConfig: { provider: 'google_drive' } };
  const controller = require('../src/controllers/storage.controller');

  const mkRes = () => ({ status: () => ({ json: () => {} }), json: () => {} });
  const baseReq = { firmId: 'F1', ownershipFirmId: 'F1', user: { role: 'admin', primary_email: 'admin@example.com' } };

  await controller.changeFirmStorage({ ...baseReq, body: { provider: 'google-drive', credentials: { googleRefreshToken: 'rt', rootFolderId: 'rf' }, verificationToken: 'ok' } }, mkRes());
  let update = state.updates[state.updates.length - 1].$set;
  assert.strictEqual(update['storage.provider'], 'google_drive');
  assert.strictEqual(update.storageConfig.provider, 'google_drive');

  await controller.changeFirmStorage({ ...baseReq, body: { provider: 'docketra_drive', credentials: {}, verificationToken: 'ok' } }, mkRes());
  update = state.updates[state.updates.length - 1].$set;
  assert.strictEqual(update['storage.provider'], 'docketra_managed');

  await controller.changeFirmStorage({ ...baseReq, body: { provider: 's3', credentials: { bucket: 'b', region: 'r', provider: 'google_drive', accessKeyId: 'ak', secretAccessKey: 'sk' }, verificationToken: 'ok' } }, mkRes());
  update = state.updates[state.updates.length - 1].$set;
  assert.strictEqual(update['storage.provider'], 's3');
  const storedS3 = JSON.parse(decrypt(update.storageConfig.credentials));
  assert.strictEqual(storedS3.provider, undefined);
  assert.strictEqual(storedS3.credentials.accessKeyId, 'ak');
  assert.strictEqual(storedS3.credentials.secretAccessKey, 'sk');
  assert.strictEqual(state.s3Tested, true);

  Module._load = originalLoad;
  console.log('✓ storage normalization regressions');
})();
