const assert = require('assert');
const request = require('supertest');

const controllerModulePath = require.resolve('../src/controllers/auth.controller');
const tenantResolverModulePath = require.resolve('../src/middleware/tenantResolver');
const superadminControllerModulePath = require.resolve('../src/controllers/superadmin.controller');
const createAppModulePath = require.resolve('../src/app/createApp');
const firmControllerModulePath = require.resolve('../src/controllers/firm.controller');
const bcryptModulePath = require.resolve('bcrypt');
process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const restore = [];

function swapModule(modulePath, exportsValue) {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

async function run() {
  const ok = (_req, res) => res.status(200).json({ success: true });

  swapModule(bcryptModulePath, {
    hash: async () => 'mock-hash',
    compare: async () => true,
    genSalt: async () => 'mock-salt',
  });

  swapModule(tenantResolverModulePath, (req, _res, next) => {
    req.firmId = '507f1f77bcf86cd799439022';
    req.firmIdString = 'FIRM001';
    req.firmSlug = req.params.firmSlug;
    req.firmName = 'Gupte OPC';
    req.firm = { status: 'active' };
    next();
  });

  swapModule(superadminControllerModulePath, {
    getFirmBySlug: (req, res) => res.status(200).json({ success: true, data: { firmSlug: req.params.firmSlug } }),
  });

  const firmNoOpHandler = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  swapModule(firmControllerModulePath, { getFirmSetupStatus: firmNoOpHandler });

  swapModule(controllerModulePath, {
    logout: ok,
    changePassword: ok,
    resetPassword: ok,
    getProfile: ok,
    updateProfile: ok,
    createUser: ok,
    activateUser: ok,
    deactivateUser: ok,
    resetPasswordWithToken: ok,
    updateUserStatus: ok,
    unlockAccount: ok,
    forgotPassword: ok,
    getAllUsers: ok,
    refreshAccessToken: ok,
    debugCookieState: ok,
    verifyTotp: ok,
    completeMfaLogin: ok,
    setupAccount: ok,
    resendSetup: ok,
    resendCredentials: ok,
    resendLoginOtp: ok,
    signupInit: ok,
    signupVerify: ok,
    signupResend: ok,
    sendOtpEndpoint: ok,
    verifyOtpEndpoint: ok,
    forgotPasswordInit: ok,
    forgotPasswordVerify: ok,
    forgotPasswordResetWithOtp: ok,
    login: ok,
    getFirmBySlug: (req, res) => res.status(200).json({ success: true, data: { firmSlug: req.params.firmSlug } }),
    loginInit: (req, res) => res.status(200).json({ success: true, loginToken: `init-${req.body.firmSlug}` }),
    loginVerify: (_req, res) => {
      res.cookie('accessToken', 'mock-access-token', { httpOnly: true });
      return res.status(200).json({ success: true, verified: true });
    },
    loginResend: (req, res) => res.status(200).json({ success: true, resent: req.body.firmSlug }),
  });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const publicLogin = await request(app).get('/api/gupte-opc/login');
  assert.strictEqual(publicLogin.status, 200);

  const publicFirm = await request(app).get('/api/public/firms/gupte-opc');
  assert.strictEqual(publicFirm.status, 200);

  const authProfile = await request(app).get('/api/auth/profile');
  assert.strictEqual(authProfile.status, 401);

  const dockets = await request(app).get('/api/dockets');
  assert.strictEqual(dockets.status, 401);

  const loginInit = await request(app).post('/api/auth/login/init').send({ firmSlug: 'gupte-opc', xid: 'X000001' });
  assert.strictEqual(loginInit.status, 200);

  const loginVerify = await request(app).post('/api/auth/login/verify').send({ firmSlug: 'gupte-opc', loginToken: 'abc', otp: '123456' });
  assert.strictEqual(loginVerify.status, 200);
  const setCookieHeader = loginVerify.headers['set-cookie'] || [];
  assert(setCookieHeader.some((value) => String(value).includes('accessToken=')));

  const authNotFirmSlug = await request(app).get('/api/auth/login');
  assert.notStrictEqual(authNotFirmSlug.status, 404);

  const superadminNotFirmSlug = await request(app).get('/api/superadmin/login');
  assert.notStrictEqual(superadminNotFirmSlug.status, 404);

  console.log('firmSlug route ordering tests passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const { modulePath, original } of restore) {
      delete require.cache[modulePath];
      if (original) {
        require.cache[modulePath] = original;
      }
    }
    delete require.cache[createAppModulePath];
  });
