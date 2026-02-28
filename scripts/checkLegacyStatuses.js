#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const statuses = await Case.distinct('status');
  const legacyStatuses = statuses.filter((status) =>
    ['PENDING', 'Pending', 'UNASSIGNED'].includes(status)
  );

  console.log('Distinct case statuses:', statuses.sort());
  console.log('Legacy statuses detected:', legacyStatuses.sort());

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Failed to check legacy statuses:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Disconnect error:', disconnectError.message);
  }
  process.exit(1);
});
