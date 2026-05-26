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
      // Root-cause regression: preconditions helper may be middleware-style and call next().
      validateTenantUserPreconditions: async (_req, _res, _user, _slug, _xid, next) => next(),
      handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async () => false,
      sendLoginOtpChallenge: async () => 'token-1',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });

  const req = { method: 'POST', originalUrl: '/api/auth/login/init', body: { xid: 'X000001', password: 'pw' }, firmId: 'f1', firmSlug: 'gupte-opc', get: () => 'ua' };
  const result = await service.login({ req });

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.success, true);
  assert.strictEqual(JSON.stringify(result.body).includes('next is not a function'), false);

  const invalidCredsService = createAuthLoginService({
    models: { User: { find: async () => [user] }, LoginSession: { deleteMany: async () => {}, create: async () => {} } },
    utils: {
      getSuperadminEnv: () => ({}),
      handleSuperadminLogin: async () => { throw new Error('should not be called'); },
      validateTenantUserPreconditions: async (_req, _res, _user, _slug, _xid, next) => next(),
      handlePasswordVerification: async (_req, res) => {
        res.status(401).json({ success: false, message: 'Invalid xID or password' });
        return false;
      },
      handlePostPasswordChecks: async () => false,
      sendLoginOtpChallenge: async () => 'token-should-not-be-used',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });
  const invalidResult = await invalidCredsService.login({ req });
  assert.strictEqual(invalidResult.statusCode, 401);
  assert.strictEqual(invalidResult.body.success, false);
  assert.strictEqual(JSON.stringify(invalidResult.body).includes('next is not a function'), false);

  const nextErrorService = createAuthLoginService({
    models: { User: { find: async () => [user] }, LoginSession: { deleteMany: async () => {}, create: async () => {} } },
    utils: {
      getSuperadminEnv: () => ({}),
      handleSuperadminLogin: async () => { throw new Error('should not be called'); },
      validateTenantUserPreconditions: async (_req, _res, _user, _slug, _xid, next) => next(new Error('PRECONDITION_FAILED')),
      handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async () => false,
      sendLoginOtpChallenge: async () => 'token-should-not-be-used',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });
  const nextErrorResult = await nextErrorService.login({ req });
  assert.strictEqual(nextErrorResult.statusCode, 500);
  assert.strictEqual(nextErrorResult.body.success, false);
  assert.strictEqual(nextErrorResult.body.code, 'AUTH_LOGIN_FAILED');
  assert.strictEqual(JSON.stringify(nextErrorResult.body).includes('next is not a function'), false);

  console.log('authLoginInitNextRegression.test.js passed');
})();
