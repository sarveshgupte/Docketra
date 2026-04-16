const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const log = require('../utils/log');

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

  const firmBulkOps = Object.entries(FIRM_STATUS_MAP).map(([from, to]) => ({
    updateMany: {
      filter: { status: from },
      update: { $set: { status: to } },
    },
  }));

  const firmResult = await Firm.bulkWrite(firmBulkOps);
  const firmUpdates = firmResult.modifiedCount || 0;

  const userBulkOps = Object.entries(USER_STATUS_MAP).map(([from, to]) => ({
    updateMany: {
      filter: { status: from },
      update: { $set: { status: to } },
    },
  }));

  const userResult = await User.bulkWrite(userBulkOps);
  const userUpdates = userResult.modifiedCount || 0;

  log.info(`[status-migration] Updated firms: ${firmUpdates}`);
  log.info(`[status-migration] Updated users: ${userUpdates}`);

  await mongoose.connection.close();
};

run().catch((error) => {
  log.error('[status-migration] failed', error);
  process.exit(1);
});
