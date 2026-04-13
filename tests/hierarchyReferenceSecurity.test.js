#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createMongoMemoryOrNull } = require('./utils/mongoMemory');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');

async function createFirmWithDefaultClient({ name, slug, clientId }) {
  const firm = await Firm.create({
    firmId: `FIRM-${slug.toUpperCase()}`,
    name,
    firmSlug: slug,
    status: 'active',
    bootstrapStatus: 'COMPLETED',
  });

  const client = await Client.create({
    clientId,
    businessName: name,
    businessAddress: 'Test Address',
    primaryContactNumber: '0000000000',
    businessEmail: `${slug}@example.com`,
    firmId: firm._id,
    isSystemClient: true,
    isDefaultClient: true,
    isInternal: true,
    createdBySystem: true,
    status: 'ACTIVE',
    isActive: true,
    createdByXid: 'SUPERADMIN',
    createdBy: 'superadmin@example.com',
  });

  firm.defaultClientId = client._id;
  await firm.save();
  return { firm, client };
}

async function createFirmUser({ firm, client, suffix, role, primaryAdminId = null, adminId = null, managerId = null }) {
  return User.create({
    xID: `X${suffix.toString().padStart(6, '0')}`,
    name: `${role}-${suffix}`,
    email: `${role.toLowerCase()}-${suffix}@example.com`,
    role,
    firmId: firm._id,
    defaultClientId: client._id,
    status: 'active',
    primaryAdminId,
    adminId,
    managerId,
    isOnboarded: true,
  });
}

async function assertValidationError(userDoc, expectedText) {
  let failed = false;
  try {
    await userDoc.save();
  } catch (error) {
    failed = true;
    assert(
      String(error.message || '').includes(expectedText),
      `Expected "${expectedText}" in validation error, got: ${error.message}`
    );
  }
  assert(failed, 'Expected save() to fail validation');
}

async function run() {
  const mongoServer = await createMongoMemoryOrNull(
    () => MongoMemoryServer.create(),
    'Skipping hierarchy reference security test (Mongo binary unavailable)'
  );
  if (!mongoServer) {
    return;
  }

  try {
    await mongoose.connect(mongoServer.getUri());

    const { firm: firmA, client: clientA } = await createFirmWithDefaultClient({
      name: 'Firm A',
      slug: 'firm-a',
      clientId: 'C100001',
    });
    const { firm: firmB, client: clientB } = await createFirmWithDefaultClient({
      name: 'Firm B',
      slug: 'firm-b',
      clientId: 'C100002',
    });

    const primaryA = await createFirmUser({ firm: firmA, client: clientA, suffix: 1, role: 'PRIMARY_ADMIN' });
    const adminA = await createFirmUser({
      firm: firmA, client: clientA, suffix: 2, role: 'ADMIN', primaryAdminId: primaryA._id,
    });
    const managerA = await createFirmUser({
      firm: firmA, client: clientA, suffix: 3, role: 'MANAGER', primaryAdminId: primaryA._id, adminId: adminA._id,
    });
    const primaryB = await createFirmUser({ firm: firmB, client: clientB, suffix: 4, role: 'PRIMARY_ADMIN' });

    const crossFirmUser = new User({
      xID: 'X000005',
      name: 'Cross Firm User',
      email: 'cross-firm-user@example.com',
      role: 'USER',
      firmId: firmA._id,
      defaultClientId: clientA._id,
      status: 'active',
      isOnboarded: true,
      primaryAdminId: primaryA._id,
      adminId: adminA._id,
      managerId: primaryB._id,
    });
    await assertValidationError(crossFirmUser, 'managerId must reference a user from the same firm');
    console.log('✓ Rejects cross-firm hierarchy references');

    const wrongRoleUser = new User({
      xID: 'X000006',
      name: 'Wrong Role User',
      email: 'wrong-role-user@example.com',
      role: 'USER',
      firmId: firmA._id,
      defaultClientId: clientA._id,
      status: 'active',
      isOnboarded: true,
      primaryAdminId: primaryA._id,
      adminId: adminA._id,
      managerId: adminA._id,
    });
    await assertValidationError(wrongRoleUser, 'managerId must reference a MANAGER user');
    console.log('✓ Rejects managerId references to non-manager roles');

    const mismatchedChainUser = new User({
      xID: 'X000007',
      name: 'Mismatched Chain User',
      email: 'mismatched-chain-user@example.com',
      role: 'USER',
      firmId: firmA._id,
      defaultClientId: clientA._id,
      status: 'active',
      isOnboarded: true,
      primaryAdminId: primaryA._id,
      adminId: adminA._id,
      managerId: managerA._id,
    });
    await mismatchedChainUser.save();
    console.log('✓ Allows valid in-firm hierarchy chain');
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

run().catch((error) => {
  console.error('hierarchyReferenceSecurity test failed:', error);
  process.exit(1);
});
