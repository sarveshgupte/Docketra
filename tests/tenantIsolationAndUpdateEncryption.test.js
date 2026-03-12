#!/usr/bin/env node
const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

function makeTestKey() {
  return crypto.randomBytes(32).toString('base64');
}

async function run() {
  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    process.env.MASTER_ENCRYPTION_KEY = makeTestKey();
    process.env.ENCRYPTION_PROVIDER = 'local';

    const { _resetProvider } = require('../src/security/encryption.service');
    _resetProvider();

    const Client = require('../src/models/Client.model');
    const TenantScopeViolationError = require('../src/errors/TenantScopeViolationError');
    const { looksEncrypted } = require('../src/security/encryption.utils');

    const firmId = new mongoose.Types.ObjectId();
    const created = await Client.create({
      clientId: 'C991001',
      firmId,
      businessName: 'Guard Test',
      businessAddress: '101 Tenant Lane',
      businessEmail: 'before@example.com',
      primaryContactNumber: '9999999999',
      createdByXid: 'XGUARD01',
      status: 'ACTIVE',
      isActive: true,
    });

    await Client.findOneAndUpdate(
      { firmId, clientId: created.clientId },
      { $set: { businessEmail: 'Updated@Example.com' } },
      { new: true }
    );

    const stored = await Client.findOne({ firmId, clientId: created.clientId })
      .setOptions({ skipTenantGuard: true })
      .lean();
    assert(looksEncrypted(stored.businessEmail), 'findOneAndUpdate should encrypt plaintext businessEmail');

    let guardError = null;
    try {
      await Client.find({}).lean();
    } catch (err) {
      guardError = err;
    }

    assert(guardError instanceof TenantScopeViolationError, 'Client.find({}) must throw TenantScopeViolationError');

    const bypass = await Client.find({}).setOptions({ skipTenantGuard: true }).lean();
    assert(Array.isArray(bypass), 'skipTenantGuard should bypass tenant scope guard');

    const superadminBypass = await Client.find({}).setOptions({ role: 'SUPERADMIN' }).lean();
    assert(Array.isArray(superadminBypass), 'SUPERADMIN role should bypass tenant scope guard');

    console.log('✓ Client update hooks encrypt plaintext on findOneAndUpdate');
    console.log('✓ Tenant scope guard blocks unscoped queries and supports bypasses');
  } catch (err) {
    console.error('tenant isolation/update encryption test failed:', err);
    process.exitCode = 1;
  } finally {
    delete process.env.MASTER_ENCRYPTION_KEY;
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

run();
