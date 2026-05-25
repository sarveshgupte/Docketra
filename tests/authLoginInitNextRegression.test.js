const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');

(async () => {
  const user = {
    _id: 'u1', xID: 'X000001', firmId: 'f1', defaultClientId: 'f1', email: 'u@example.com', status: 'active', isActive: true,
  };
  const service = createAuthLoginService({
    models: { User: { find: async () => [user] }, LoginSession: { deleteMany: async () => {}, create: async () => {} } },
    utils: {
      getSuperadminEnv: () => ({}),
      handleSuperadminLogin: async () => { throw new Error('should not be called'); },
      validateTenantUserPreconditions: async (_req, _res, _user, _slug, _xid, next) => next(),
      handlePasswordVerification: async (_req, _res, _user, _password, next) => next(),
      handlePostPasswordChecks: async (_req, _res, _user, next) => next(),
      sendLoginOtpChallenge: async () => 'token-1',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });

  const req = { method: 'POST', originalUrl: '/api/auth/login/init', body: { xid: 'X000001', password: 'pw' }, firmId: 'f1', firmSlug: 'gupte-opc', get: () => 'ua' };
  const result = await service.login({ req });
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.success, true);
  assert.strictEqual(JSON.stringify(result.body).includes('next is not a function'), false);
  console.log('authLoginInitNextRegression.test.js passed');
})();
