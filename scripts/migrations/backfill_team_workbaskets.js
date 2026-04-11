/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../../src/config/database');
const User = require('../../src/models/User.model');
const Team = require('../../src/models/Team.model');
const Case = require('../../src/models/Case.model');

async function run() {
  await connectDB();

  const firms = await User.distinct('firmId', { firmId: { $ne: null }, role: { $ne: 'SUPER_ADMIN' } });

  for (const firmId of firms) {
    let defaultTeam = await Team.findOne({ firmId, name: 'Default Team' });
    if (!defaultTeam) {
      defaultTeam = await Team.create({ firmId, name: 'Default Team' });
      console.log(`Created default team for firm ${firmId}`);
    }

    const userRes = await User.updateMany(
      { firmId, role: { $ne: 'SUPER_ADMIN' }, $or: [{ teamId: null }, { teamId: { $exists: false } }] },
      { $set: { teamId: defaultTeam._id } },
    );

    const caseRes = await Case.updateMany(
      { firmId, $or: [{ ownerTeamId: null }, { ownerTeamId: { $exists: false } }] },
      { $set: { ownerTeamId: defaultTeam._id } },
    );

    console.log(`Firm ${firmId}: users=${userRes.modifiedCount}, cases=${caseRes.modifiedCount}`);
  }

  await mongoose.connection.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
