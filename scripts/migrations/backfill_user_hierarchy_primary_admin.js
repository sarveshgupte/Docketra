#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../../src/models/User.model');
const { normalizeRole } = require('../../src/utils/role.utils');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    const firmIds = await User.distinct('firmId', {
      firmId: { $ne: null },
      role: { $ne: 'SUPER_ADMIN' },
      status: { $ne: 'deleted' },
    });

    for (const firmId of firmIds) {
      const users = await User.find({
        firmId,
        role: { $ne: 'SUPER_ADMIN' },
        status: { $ne: 'deleted' },
      })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id role isPrimaryAdmin createdAt')
        .lean();

      if (!users.length) continue;

      const currentPrimary = users.find((entry) => normalizeRole(entry.role) === 'PRIMARY_ADMIN') || users[0];
      await User.updateOne(
        { _id: currentPrimary._id },
        {
          $set: {
            role: 'PRIMARY_ADMIN',
            isPrimaryAdmin: true,
            primaryAdminId: null,
            adminId: null,
            managerId: null,
            reportsToUserId: null,
          },
        },
      );

      for (const user of users) {
        if (String(user._id) === String(currentPrimary._id)) continue;
        const normalizedRole = normalizeRole(user.role);
        const update = {
          primaryAdminId: currentPrimary._id,
          isPrimaryAdmin: false,
        };

        if (normalizedRole === 'PRIMARY_ADMIN') {
          update.role = 'ADMIN';
        }
        if (normalizedRole === 'ADMIN') {
          update.adminId = null;
          update.managerId = null;
          update.reportsToUserId = null;
        } else if (normalizedRole === 'MANAGER') {
          update.managerId = null;
          update.reportsToUserId = null;
        }

        await User.updateOne({ _id: user._id }, { $set: update });
      }

      console.log(`✓ backfilled firm=${firmId} primaryAdmin=${currentPrimary._id}`);
    }
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('❌ backfill failed:', error);
  process.exit(1);
});
