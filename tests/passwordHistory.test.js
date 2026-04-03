const assert = require('assert');
const bcrypt = require('bcrypt');
const { changePassword, resetPasswordWithToken } = require('../src/controllers/auth.controller');
const User = require('../src/models/User.model');
const RefreshToken = require('../src/models/RefreshToken.model');

const createMockRes = () => {
  const body = {};
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      Object.assign(body, payload);
      return this;
    },
  };
  return { res, body };
};

async function testPasswordHistory() {
  console.log('Running Password History Optimization Tests...');

  const originalBcryptCompare = bcrypt.compare;
  const originalBcryptHash = bcrypt.hash;
  const originalUserSave = User.prototype.save;
  const originalUserFindOne = User.findOne;
  const originalRefreshTokenUpdateMany = RefreshToken.updateMany;

  const passwordHistory = [
    { hash: await bcrypt.hash('oldPass1', 10), changedAt: new Date() },
    { hash: await bcrypt.hash('oldPass2', 10), changedAt: new Date() },
  ];

  const mockUser = {
    _id: 'user123',
    xID: 'X123',
    firmId: 'firm123',
    passwordHash: await bcrypt.hash('currentPass', 10),
    passwordHistory: [...passwordHistory],
    mustSetPassword: false,
    save: async function() { return this; },
  };

  // Mocking bcrypt.compare to track calls
  let compareCalls = 0;
  bcrypt.compare = async (data, hash) => {
    compareCalls++;
    return originalBcryptCompare(data, hash);
  };

  // 1. Test changePassword with reused password from history
  const { res: res1, body: body1 } = createMockRes();
  const req1 = {
    body: { currentPassword: 'currentPass', newPassword: 'oldPass1' },
    user: mockUser,
    ip: '127.0.0.1',
    get: () => 'agent'
  };

  await changePassword(req1, res1);
  assert.strictEqual(res1.statusCode, 400);
  assert.strictEqual(body1.message, 'Cannot reuse any of your last 5 passwords');
  console.log('  ✓ changePassword rejects reused password from history');

  // 2. Test resetPasswordWithToken with reused password
  const { res: res2, body: body2 } = createMockRes();
  const req2 = {
    body: { token: 'valid-token', password: 'oldPass2' },
    ip: '127.0.0.1',
    get: () => 'agent'
  };

  User.findOne = async () => mockUser;
  // Mocking hashToken
  const emailService = require('../src/services/email.service');
  const originalHashToken = emailService.hashToken;
  emailService.hashToken = (t) => t;

  await resetPasswordWithToken(req2, res2);
  assert.strictEqual(res2.statusCode, 400);
  assert.strictEqual(body2.message, 'Cannot reuse any of your last 5 passwords');
  console.log('  ✓ resetPasswordWithToken rejects reused password from history');

  // 3. Test successful password change (not reused)
  compareCalls = 0;
  const { res: res3, body: body3 } = createMockRes();
  const req3 = {
    body: { currentPassword: 'currentPass', newPassword: 'newPass#123' },
    user: { ...mockUser, passwordHistory: [...passwordHistory] }, // Fresh copy
    ip: '127.0.0.1',
    get: () => 'agent'
  };
  req3.user.save = async function() { return this; };
  RefreshToken.updateMany = async () => ({});

  await changePassword(req3, res3);
  assert.strictEqual(res3.statusCode, 200);
  assert.strictEqual(body3.success, true);
  console.log('  ✓ changePassword succeeds with new password');

  // Restore mocks
  bcrypt.compare = originalBcryptCompare;
  User.prototype.save = originalUserSave;
  User.findOne = originalUserFindOne;
  RefreshToken.updateMany = originalRefreshTokenUpdateMany;
  emailService.hashToken = originalHashToken;

  console.log('Password History Optimization Tests Passed.');
}

testPasswordHistory().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
