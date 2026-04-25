#!/usr/bin/env node
'use strict';

const assert = require('assert');

const User = require('../src/models/User.model');

async function testLegacyXidCanPersistOtpStateAndNormalizes() {
  const user = new User({
    xID: 'X000001',
    xid: 'DK-ABCDE',
    name: 'Legacy User',
    email: 'legacy@example.com',
    role: 'SUPER_ADMIN',
    status: 'active',
    isActive: true,
  });

  user.loginOtpHash = 'otp-hash';
  user.loginOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await user.validate();

  assert.strictEqual(user.xid, 'X000001', 'legacy xid should be normalized before OTP-related save');
  assert.strictEqual(user.loginOtpHash, 'otp-hash', 'OTP challenge fields should still validate successfully');
}

async function testNewUsersDefaultXidAliasToXid() {
  const user = new User({
    xID: 'X000002',
    name: 'New User',
    email: 'new@example.com',
    role: 'SUPER_ADMIN',
    status: 'active',
    isActive: true,
  });

  await user.validate();
  assert.strictEqual(user.xid, user.xID, 'new users should keep xid alias synchronized with xID');
}

async function testInvalidXidStillRejected() {
  const user = new User({
    xID: 'DK-ABCDE',
    xid: 'DK-ABCDE',
    name: 'Invalid User',
    email: 'invalid@example.com',
    role: 'SUPER_ADMIN',
    status: 'active',
    isActive: true,
  });

  let rejected = false;
  try {
    await user.validate();
  } catch (error) {
    rejected = true;
    assert.match(String(error.message), /xID must be in format X123456/);
  }

  assert.strictEqual(rejected, true, 'invalid xID should remain rejected');
}

(async () => {
  try {
    await testLegacyXidCanPersistOtpStateAndNormalizes();
    await testNewUsersDefaultXidAliasToXid();
    await testInvalidXidStillRejected();

    console.log('legacyXidNormalizationAuthFlows tests passed');
  } catch (error) {
    console.error('legacyXidNormalizationAuthFlows tests failed:', error);
    process.exit(1);
  }
})();
