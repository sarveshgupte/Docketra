const assert = require('assert');
const path = require('path');

function mockModule(relPath, exportsValue) {
  const abs = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: exportsValue };
}

const controllerPath = require.resolve('../src/controllers/client.controller');
delete require.cache[controllerPath];

let createPayload = null;
let profilePayload = null;

mockModule('src/repositories/ClientRepository.js', {
  create: async (payload) => {
    createPayload = payload;
    return { _id: 'mongo1', clientId: payload.clientId, firmId: payload.firmId, status: payload.status, isActive: true, profileRef: { provider: 'google' } };
  },
  findByClientId: async () => ({ _id: 'mongo1', clientId: 'C000001', firmId: 'f1', status: 'ACTIVE', isActive: true, profileRef: { provider: 'google' } }),
  updateByClientId: async () => ({ modifiedCount: 1 }),
  find: async () => [],
  count: async () => 0,
});
mockModule('src/services/clientIdGenerator.js', { generateNextClientId: async () => 'C000001' });
mockModule('src/utils/executeWrite.js', { executeWrite: async (_req, fn) => fn() });
mockModule('src/services/tenantMetrics.service.js', { incrementTenantMetric: async () => null });
mockModule('src/services/clientProfileWriteGuard.service.js', { persistClientProfileOrRollback: async ({ profileInput }) => { profilePayload = profileInput; } });
mockModule('src/services/clientProfileStorage.service.js', { clientProfileStorageService: { getClientProfile: async () => ({ profile: { legalName: 'Acme' } }), hydrateClientWithProfile: (c) => ({ ...c, businessName: 'Acme' }), updateClientProfile: async () => null } });
mockModule('src/models/Firm.model.js', { findById: () => ({ select: () => ({ lean: async () => null }) }) });
mockModule('src/services/defaultClient.service.js', { ensureDefaultClientForFirm: async () => null });
mockModule('src/repositories/AttachmentRepository.js', { findByClientSource: async () => [] });
mockModule('src/services/storage/StorageProviderFactory.js', { StorageProviderFactory: { getProvider: async () => ({}) } });
mockModule('src/services/cfsDrive.service.js', { createClientCFSFolderStructure: async () => ({}) });
mockModule('src/middleware/wrapWriteHandler.js', (fn) => fn);

const { createClient } = require('../src/controllers/client.controller');

const req = { body: { businessName: 'Acme', businessEmail: 'a@b.com', primaryContactNumber: '123', businessAddress: 'Addr' }, user: { xID: 'X1', firmId: 'f1', role: 'admin', email: 'u@x.com' }, headers: {} };
const res = { statusCode: 200, status(code){ this.statusCode = code; return this; }, jsonPayload: null, json(payload){ this.jsonPayload = payload; return this; }, set(){ return this; } };

(async () => {
  await createClient(req, res);
  assert.strictEqual(res.statusCode, 201);
  assert.ok(createPayload);
  assert.strictEqual(createPayload.businessName, undefined);
  assert.strictEqual(createPayload.businessEmail, undefined);
  assert.strictEqual(createPayload.primaryContactNumber, undefined);
  assert.ok(createPayload.clientId && createPayload.firmId);
  assert.ok(profilePayload && profilePayload.legalName === 'Acme');
  console.log('client.controller.cloudFirstCreate test passed');
})();
