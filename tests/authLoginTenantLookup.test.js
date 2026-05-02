const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');

const createRes = () => {
  const state = { statusCode: 200, body: null };
  return {
    state,
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return payload; },
    setHeader() {},
  };
};

const baseDeps = (users, preconditionResult = false) => ({
  models: {
    User: {
      find: async (query) => users.filter((u) => {
        if (u.xID !== query.xID) return false;
        if (u.status === 'deleted') return false;
        const ids = query.$or[0].firmId.$in;
        return ids.includes(String(u.firmId)) || ids.includes(String(u.defaultClientId || ''));
      }),
    },
  },
  utils: {
    getSuperadminEnv: () => ({ normalizedXID: null }),
    handleSuperadminLogin: async () => {},
    validateTenantUserPreconditions: async (_req, res, user) => {
      if (preconditionResult) {
        res.status(401).json({ success: false, message: 'Invalid xID or password' });
        return true;
      }
      if (!user || user.status !== 'active' || user.isActive === false) {
        res.status(401).json({ success: false, message: 'Invalid xID or password' });
        return true;
      }
      return false;
    },
    handlePasswordVerification: async () => true,
    handlePostPasswordChecks: async () => false,
    sendLoginOtpChallenge: async () => 'lt',
    getLoginOtpConfig: () => ({ resendCooldownSeconds: 30 }),
  },
});

const makeReq = () => ({
  loginScope: 'tenant',
  body: { xID: 'X000001', password: 'pw' },
  params: { firmSlug: 'gupte-opc' },
  firmSlug: 'gupte-opc',
  firmId: 'canonical-1',
  firm: { legacyFirmId: 'legacy-1', defaultClientId: 'canonical-1' },
});

async function testLegacyFirmIdMatch() {
  const service = createAuthLoginService(baseDeps([{ xID: 'X000001', status: 'active', isActive: true, firmId: 'legacy-1' }]));
  const res = createRes();
  await service.login(makeReq(), res);
  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.body.otpRequired, true);
}

async function testDefaultClientIdMatch() {
  const service = createAuthLoginService(baseDeps([{ xID: 'X000001', status: 'active', isActive: true, firmId: 'other', defaultClientId: 'canonical-1' }]));
  const res = createRes();
  await service.login(makeReq(), res);
  assert.strictEqual(res.state.statusCode, 200);
}

async function testCrossFirmFails() {
  const service = createAuthLoginService(baseDeps([{ xID: 'X000001', status: 'active', isActive: true, firmId: 'other-firm', defaultClientId: 'other-firm' }], true));
  const res = createRes();
  await service.login(makeReq(), res);
  assert.strictEqual(res.state.statusCode, 401);
}



async function testObjectIdLikeNormalizationAndSelfRefSafety() {
  const oid = { toHexString: () => '69de10f8761bb7db6c320184', toString: () => 'oid-str' };
  const selfRef = {};
  selfRef._id = selfRef;

  const users = [
    { xID: 'X000001', status: 'active', isActive: true, firmId: { toHexString: () => '69de10f8761bb7db6c320183', toString: () => '69de10f8761bb7db6c320183' } },
    { xID: 'X000001', status: 'active', isActive: true, firmId: '69de10f8761bb7db6c320183', defaultClientId: oid },
  ];

  const service = createAuthLoginService(baseDeps(users));
  const req = makeReq();
  req.firmId = oid;
  req.firm = {
    id: selfRef,
    legacyFirmId: { toHexString: () => '69de10f8761bb7db6c320183', toString: () => '69de10f8761bb7db6c320183' },
    defaultClientId: { _id: { toHexString: () => '69de10f8761bb7db6c320184', toString: () => '69de10f8761bb7db6c320184' } },
  };

  const res = createRes();
  await service.login(req, res);
  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.body.otpRequired, true);
}

async function testDeletedInactiveFail() {
  const serviceDeleted = createAuthLoginService(baseDeps([{ xID: 'X000001', status: 'deleted', isActive: true, firmId: 'legacy-1' }], true));
  const resDeleted = createRes();
  await serviceDeleted.login(makeReq(), resDeleted);
  assert.strictEqual(resDeleted.state.statusCode, 401);

  const serviceInactive = createAuthLoginService(baseDeps([{ xID: 'X000001', status: 'inactive', isActive: false, firmId: 'legacy-1' }], true));
  const resInactive = createRes();
  await serviceInactive.login(makeReq(), resInactive);
  assert.strictEqual(resInactive.state.statusCode, 401);
}

(async () => {
  await testLegacyFirmIdMatch();
  await testDefaultClientIdMatch();
  await testCrossFirmFails();
  await testDeletedInactiveFail();
  await testObjectIdLikeNormalizationAndSelfRefSafety();
  console.log('authLoginTenantLookup.test.js passed');
})();
