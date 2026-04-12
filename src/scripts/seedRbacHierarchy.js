/* eslint-disable no-console */
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User.model');
const Team = require('../models/Team.model');

async function run() {
  await connectDB();
  const firmUsers = await User.find({ role: { $in: ['PRIMARY_ADMIN', 'ADMIN'] }, status: { $ne: 'deleted' } })
    .select('_id firmId teamId role')
    .lean();

  for (const admin of firmUsers) {
    if (!admin.teamId && admin.firmId) {
      const team = await Team.findOne({ firmId: admin.firmId, name: 'General' }).lean();
      if (team?._id) {
        await User.updateOne({ _id: admin._id }, { $set: { teamId: team._id } });
      }
    }
  }

  console.log(`[RBAC_SEED] Processed ${firmUsers.length} admin users`);
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error('[RBAC_SEED] failed', error);
  await mongoose.connection.close();
  process.exit(1);
});
