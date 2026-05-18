const assert = require('assert');
const User = require('../src/models/User.model');

const SENSITIVE_PATHS = [
  'passwordHash',
  'authProviders.local.passwordHash',
  'passwordSetupTokenHash',
  'inviteTokenHash',
  'setupTokenHash',
  'passwordResetTokenHash',
  'forgotPasswordResetTokenHash',
  'loginOtpHash',
  'forgotPasswordOtpHash',
  'twoFactorSecret',
  'passwordHistory',
  'lockUntil',
  'failedLoginAttempts',
  'signupIP',
  'signupUserAgent',
  'lastLoginIp',
  'lastLoginCountry',
  'deletedAuthSnapshot',
];

const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

const assertNoSensitivePaths = (payload, label) => {
  for (const path of SENSITIVE_PATHS) {
    assert.strictEqual(getPath(payload, path), undefined, `${label} leaked ${path}`);
  }
};

(() => {
  const userDoc = new User({
    xID: 'X000123',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'USER',
    firmId: '507f191e810c19729de860ea',
    defaultClientId: '507f191e810c19729de860eb',
    passwordHash: 'legacy-hash',
    authProviders: { local: { passwordHash: 'nested-hash', passwordSet: true } },
    passwordSetupTokenHash: 'psth',
    inviteTokenHash: 'ith',
    setupTokenHash: 'sth',
    passwordResetTokenHash: 'prth',
    forgotPasswordResetTokenHash: 'fprth',
    loginOtpHash: 'loh',
    forgotPasswordOtpHash: 'fpoh',
    twoFactorSecret: 'plaintext-secret',
    passwordHistory: [{ hash: 'h1', changedAt: new Date() }],
    lockUntil: new Date(Date.now() + 100000),
    failedLoginAttempts: 9,
    signupIP: '127.0.0.1',
    signupUserAgent: 'jest',
    lastLoginIp: '1.1.1.1',
    lastLoginCountry: 'US',
    deletedAuthSnapshot: { status: 'disabled', isActive: false },
  });

  assertNoSensitivePaths(userDoc.toSafeObject(), 'toSafeObject');
  assertNoSensitivePaths(userDoc.toJSON(), 'toJSON');
  assertNoSensitivePaths(JSON.parse(JSON.stringify(userDoc)), 'JSON.stringify(userDoc)');

  const listPayload = [userDoc].map((entry) => entry.toJSON());
  assertNoSensitivePaths(listPayload[0], 'user list payload');

  const detailPayload = { data: userDoc.toSafeObject() };
  assertNoSensitivePaths(detailPayload.data, 'user detail payload');

  const selfPayload = { data: userDoc.toSafeObject() };
  assertNoSensitivePaths(selfPayload.data, 'self user payload');

  const superadminPayload = { data: userDoc.toSafeObject() };
  assertNoSensitivePaths(superadminPayload.data, 'superadmin user payload');

  console.log('✅ user serialization privacy test passed');
})();
