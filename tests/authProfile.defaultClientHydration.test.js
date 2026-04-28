#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore
  }
};

const buildReq = () => ({
  user: { _id: 'user-1', role: 'PRIMARY_ADMIN' },
  jwt: {
    role: 'PRIMARY_ADMIN',
    firmId: 'runtime-tenant-1',
    firmSlug: 'gupte-opc',
  },
  id: 'req-1',
  requestId: 'req-1',
  ip: '127.0.0.1',
  get: () => 'test-agent',
});

const buildRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

async function withControllerStubs(runTest, overrides = {}) {
  Module._load = function(request, parent, isMain) {
    if (request === 'bcrypt') {
      return {
        hash: async () => 'hash',
        compare: async () => true,
      };
    }
    if (request === '../models/User.model') {
      return overrides.UserModel;
    }
    if (request === '../models/UserProfile.model') {
      return {
        findOne: async () => null,
      };
    }
    if (request === '../models/Team.model') {
      return {
        find: () => ({
          select() { return this; },
          lean: async () => [],
        }),
      };
    }
    if (request === '../models/Client.model') {
      return overrides.ClientModel || {
        findById: () => ({
          select() { return this; },
          lean: async () => null,
        }),
      };
    }
    if (request === '../services/defaultClient.guard') {
      return {
        getOrCreateDefaultClient: overrides.getOrCreateDefaultClient,
      };
    }
    if (request === '../services/productUpdate.service') {
      return {
        getLatestPublishedUpdate: async () => null,
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return {
        resolveCanonicalTenantFromFirmId: async () => ({ tenantId: 'runtime-tenant-1', firmSlug: 'gupte-opc' }),
        resolveCanonicalTenantForUser: async () => ({ tenantId: 'runtime-tenant-1', firmSlug: 'gupte-opc' }),
      };
    }
    if (request === '../utils/log') {
      return {
        error: () => {},
        warn: () => {},
        info: () => {},
      };
    }
    if (request === '../utils/tutorialState.utils') {
      return {
        getTutorialStatus: () => ({ completed: false }),
        shouldShowWelcomeTutorial: () => false,
      };
    }
    if (request === '../utils/role.utils') {
      return {
        isSuperAdminRole: () => false,
        normalizeRole: (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { getProfile } = require('../src/controllers/auth.controller');

  try {
    await runTest(getProfile);
  } finally {
    Module._load = originalLoad;
    clearModule('../src/controllers/auth.controller');
  }
}

async function testProfileWithPopulatedFirmSelfHealsUsingMongoId() {
  let guardArg = null;

  const populatedFirm = {
    _id: { toString: () => '69de10f8761bb7db6c320183' },
    firmId: 'FIRM001',
    name: 'Gupte OPC',
    firmSlug: 'gupte-opc',
  };

  const dbUser = {
    _id: { toString: () => 'user-1' },
    xID: 'X000001',
    name: 'Primary Admin',
    email: 'admin@example.com',
    role: 'PRIMARY_ADMIN',
    mustSetPassword: false,
    passwordSetAt: null,
    allowedCategories: [],
    isActive: true,
    firmId: populatedFirm,
    defaultClientId: null,
    save: async function save() { return this; },
  };

  await withControllerStubs(async (getProfile) => {
    const req = buildReq();
    const res = buildRes();

    await getProfile(req, res);

    assert.strictEqual(res.statusCode, 200, 'profile should succeed for populated firm context');
    assert.strictEqual(guardArg, '69de10f8761bb7db6c320183', 'default client guard must receive firm Mongo _id only');
    assert.strictEqual(res.payload?.data?.firmId, '69de10f8761bb7db6c320183');
    assert.strictEqual(res.payload?.data?.firmCode, 'FIRM001');
    assert.strictEqual(res.payload?.data?.firmSlug, 'gupte-opc');
    assert.strictEqual(res.payload?.data?.defaultClientId, 'client-1');
    assert.strictEqual(res.payload?.data?.tenantId, 'runtime-tenant-1');
  }, {
    UserModel: {
      findById: () => ({
        populate: async () => dbUser,
      }),
    },
    getOrCreateDefaultClient: async (firmId) => {
      guardArg = firmId;
      return { _id: { toString: () => 'client-1' }, firmId: '69de10f8761bb7db6c320183', isDefaultClient: true };
    },
  });

  console.log('  ✓ getProfile normalizes populated firm document to firmMongoId for self-heal');
}

async function testProfileWithExistingDefaultClientAvoidsRepair503() {
  let guardCalls = 0;
  let clientFindByIdArg = null;

  const dbUser = {
    _id: { toString: () => 'user-1' },
    xID: 'X000001',
    name: 'Primary Admin',
    email: 'admin@example.com',
    role: 'PRIMARY_ADMIN',
    mustSetPassword: false,
    passwordSetAt: null,
    allowedCategories: [],
    isActive: true,
    firmId: {
      _id: { toString: () => '69de10f8761bb7db6c320183' },
      firmId: 'FIRM001',
      name: 'Gupte OPC',
      firmSlug: 'gupte-opc',
    },
    defaultClientId: { toString: () => 'client-existing' },
    save: async function save() { return this; },
  };

  await withControllerStubs(async (getProfile) => {
    const req = buildReq();
    const res = buildRes();

    await getProfile(req, res);

    assert.strictEqual(res.statusCode, 200, 'profile should not 503 when defaultClientId is already valid');
    assert.strictEqual(guardCalls, 0, 'self-heal should not create when default client is already valid');
    assert.strictEqual(clientFindByIdArg, dbUser.defaultClientId, 'default client lookup should use stored id only');
    assert.strictEqual(res.payload?.data?.defaultClientId, 'client-existing');
  }, {
    UserModel: {
      findById: () => ({
        populate: async () => dbUser,
      }),
    },
    ClientModel: {
      findById: (id) => {
        clientFindByIdArg = id;
        return {
          select() { return this; },
          lean: async () => ({ _id: 'client-existing', firmId: '69de10f8761bb7db6c320183', isDefaultClient: true }),
        };
      },
    },
    getOrCreateDefaultClient: async () => {
      guardCalls += 1;
      return { _id: 'client-new' };
    },
  });

  console.log('  ✓ getProfile returns 200 when existing defaultClientId is valid');
}

async function run() {
  try {
    await testProfileWithPopulatedFirmSelfHealsUsingMongoId();
    await testProfileWithExistingDefaultClientAvoidsRepair503();
    console.log('\n✅ authProfile.defaultClientHydration tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ authProfile.defaultClientHydration tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
