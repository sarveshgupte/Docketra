/* eslint-disable no-console */
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Team = require('../models/Team.model');
const { normalizeRole } = require('../utils/role.utils');

const MIGRATION_ROLES = ['PRIMARY_ADMIN', 'ADMIN', 'Admin', 'Employee'];

async function normalizeLegacyRoles(firmId) {
  const users = await User.find({ firmId, role: { $in: MIGRATION_ROLES } }).select('_id role');
  for (const user of users) {
    const normalized = normalizeRole(user.role);
    if (normalized && normalized !== user.role) {
      user.role = normalized;
      await user.save();
    }
  }
}

async function ensurePrimaryAdminForFirm(firm) {
  const firmId = firm._id;
  await normalizeLegacyRoles(firmId);

  const admins = await User.find({
    firmId,
    role: { $in: ['PRIMARY_ADMIN', 'ADMIN'] },
    status: { $ne: 'deleted' },
  }).sort({ createdAt: 1, _id: 1 });

  if (admins.length === 0) return null;

  const primary = admins[0];
  await User.updateMany(
    { firmId, _id: { $ne: primary._id }, role: 'PRIMARY_ADMIN' },
    { $set: { role: 'ADMIN', isPrimaryAdmin: false } },
  );

  primary.role = 'PRIMARY_ADMIN';
  primary.isPrimaryAdmin = true;
  await primary.save();

  await User.updateMany(
    { firmId, _id: { $ne: primary._id }, role: 'ADMIN' },
    { $set: { isPrimaryAdmin: false } },
  );

  await Firm.updateOne({ _id: firmId }, { $set: { billingOwnerId: primary._id } });
  return primary;
}

async function ensureGeneralTeamForFirm(firm) {
  const firmId = firm._id;
  let team = await Team.findOne({ firmId, name: 'General' });
  if (!team) {
    team = await Team.create({ firmId, name: 'General', isActive: true });
  }

  await User.updateMany(
    {
      firmId,
      role: { $ne: 'SUPER_ADMIN' },
      status: { $ne: 'deleted' },
      $or: [{ teamId: { $exists: false } }, { teamId: null }],
    },
    { $set: { teamId: team._id } },
  );

  return team;
}

async function run() {
  await connectDB();

  const firms = await Firm.find({}).select('_id firmId name').lean();
  for (const firm of firms) {
    const primary = await ensurePrimaryAdminForFirm(firm);
    const team = await ensureGeneralTeamForFirm(firm);
    console.log(`[RBAC_MIGRATION] firm=${firm.firmId} primary=${primary?.xID || 'none'} team=${team._id}`);
  }

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error('[RBAC_MIGRATION] failed', error);
  await mongoose.connection.close();
  process.exit(1);
});
