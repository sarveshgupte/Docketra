#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createMongoMemoryOrNull } = require('./utils/mongoMemory');

async function run() {
  let mongoServer;

  try {
    mongoServer = await createMongoMemoryOrNull(
      () => MongoMemoryServer.create(),
      'Skipping tenant scope guard plugin test (Mongo binary unavailable)'
    );
    if (!mongoServer) {
      console.log('✓ tenant scope guard plugin test skipped (Mongo binary unavailable)');
      return;
    }

    await mongoose.connect(mongoServer.getUri());

    const Client = require('../src/models/Client.model');
    const TenantScopeViolationError = require('../src/errors/TenantScopeViolationError');

    const firmId = new mongoose.Types.ObjectId();

    await Client.create({
      clientId: 'CTSG001',
      firmId,
      businessName: 'Tenant Guard Client',
      businessAddress: '100 Isolation Ave',
      businessEmail: 'tenant-guard@example.com',
      primaryContactNumber: '1234567890',
      createdByXid: 'XGUARD02',
      status: 'ACTIVE',
      isActive: true,
    });

    // Authentication/bootstrap phase query should be allowed when role is not present.
    const unauthenticatedQuery = await Client.find({}).lean();
    assert(Array.isArray(unauthenticatedQuery), 'queries without auth context should be allowed');

    let scopedGuardError;
    try {
      await Client.find({}).setOptions({ role: 'Admin' }).lean();
    } catch (err) {
      scopedGuardError = err;
    }

    assert(
      scopedGuardError instanceof TenantScopeViolationError,
      'authenticated query without firm scope should throw TenantScopeViolationError'
    );

    const scopedResult = await Client.find({ firmId }).setOptions({ role: 'Admin' }).lean();
    assert(scopedResult.length >= 1, 'authenticated query with firm scope should pass');

    let nestedOperatorGuardError;
    try {
      await Client.find({
        $or: [{ status: 'ACTIVE' }, { clientId: 'CTSG001' }],
      })
        .setOptions({ role: 'Admin' })
        .lean();
    } catch (err) {
      nestedOperatorGuardError = err;
    }

    assert(
      nestedOperatorGuardError instanceof TenantScopeViolationError,
      'unscoped $or query should throw TenantScopeViolationError'
    );

    let aggregateGuardError;
    try {
      await Client.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).option({ role: 'Admin' });
    } catch (err) {
      aggregateGuardError = err;
    }

    assert(
      aggregateGuardError instanceof TenantScopeViolationError,
      'aggregate without firm-scoped $match should throw TenantScopeViolationError'
    );

    const unauthenticatedAggregate = await Client.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    assert(Array.isArray(unauthenticatedAggregate), 'aggregate should be allowed without auth context');

    const countWithScope = await Client.countDocuments({ firmId }).setOptions({ role: 'Admin' });
    assert(countWithScope >= 1, 'countDocuments with firm scope should pass');

    let countGuardError;
    try {
      await Client.countDocuments({}).setOptions({ role: 'Admin' });
    } catch (err) {
      countGuardError = err;
    }

    assert(
      countGuardError instanceof TenantScopeViolationError,
      'countDocuments without firm scope should throw TenantScopeViolationError'
    );

    console.log('✓ tenant scope guard allows unauthenticated bootstrap/auth queries');
    console.log('✓ tenant scope guard blocks authenticated unscoped queries, including $or and aggregate');
    console.log('✓ tenant scope guard covers additional query methods like countDocuments');
  } catch (err) {
    console.error('tenant scope guard plugin test failed:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

run();
