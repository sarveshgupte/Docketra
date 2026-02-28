const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');

const FIRM_STATUS_MAP = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INACTIVE: 'suspended',
};

const USER_STATUS_MAP = {
  INVITED: 'invited',
  ACTIVE: 'active',
  DISABLED: 'suspended',
  DELETED: 'deleted',
};

const run = async () => {
  await connectDB();

  let firmUpdates = 0;
  for (const [from, to] of Object.entries(FIRM_STATUS_MAP)) {
    const result = await Firm.updateMany({ status: from }, { $set: { status: to } });
    firmUpdates += result.modifiedCount || 0;
  }

  let userUpdates = 0;
  for (const [from, to] of Object.entries(USER_STATUS_MAP)) {
    const result = await User.updateMany({ status: from }, { $set: { status: to } });
    userUpdates += result.modifiedCount || 0;
  }

  console.log(`[status-migration] Updated firms: ${firmUpdates}`);
  console.log(`[status-migration] Updated users: ${userUpdates}`);

  await mongoose.connection.close();
};

run().catch((error) => {
  console.error('[status-migration] failed', error);
  process.exit(1);
});
