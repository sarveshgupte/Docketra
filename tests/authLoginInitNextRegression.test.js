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


  const modelSource = require('fs').readFileSync(require('path').resolve(__dirname, '../src/models/User.model.js'), 'utf8');
  const findOneHookMatch = modelSource.match(/userSchema\.pre\('findOneAndUpdate',\s*function\(([^)]*)\)/);
  const updateManyHookMatch = modelSource.match(/userSchema\.pre\('updateMany',\s*function\(([^)]*)\)/);
  assert(findOneHookMatch, 'findOneAndUpdate hierarchy hook should exist');
  assert(updateManyHookMatch, 'updateMany hierarchy hook should exist');
  assert.strictEqual(findOneHookMatch[1].trim().length, 0, 'findOneAndUpdate pre hook must be promise/sync style (length 0)');
  assert.strictEqual(updateManyHookMatch[1].trim().length, 0, 'updateMany pre hook must be promise/sync style (length 0)');

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

  const middlewarePasswordService = createAuthLoginService({
    models: { User: { find: async () => [user] }, LoginSession: { deleteMany: async () => {}, create: async () => {} } },
    utils: {
      getSuperadminEnv: () => ({}),
      handleSuperadminLogin: async () => { throw new Error('should not be called'); },
      validateTenantUserPreconditions: async () => false,
      handlePasswordVerification: async (_req, _res, _user, _password, next) => next(),
      handlePostPasswordChecks: async () => false,
      sendLoginOtpChallenge: async () => 'token-2',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });
  const middlewarePasswordResult = await middlewarePasswordService.login({ req });
  assert.strictEqual(middlewarePasswordResult.statusCode, 200);
  assert.strictEqual(middlewarePasswordResult.body.success, true);

  const middlewarePostChecksService = createAuthLoginService({
    models: { User: { find: async () => [user] }, LoginSession: { deleteMany: async () => {}, create: async () => {} } },
    utils: {
      getSuperadminEnv: () => ({}),
      handleSuperadminLogin: async () => { throw new Error('should not be called'); },
      validateTenantUserPreconditions: async () => false,
      handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async (_req, _res, _user, next) => next(),
      sendLoginOtpChallenge: async () => 'token-3',
      getLoginOtpConfig: () => ({ resendCooldownSeconds: 60 }),
    },
  });
  const middlewarePostChecksResult = await middlewarePostChecksService.login({ req });
  assert.strictEqual(middlewarePostChecksResult.statusCode, 200);
  assert.strictEqual(middlewarePostChecksResult.body.success, true);

  console.log('authLoginInitNextRegression.test.js passed');
})();
