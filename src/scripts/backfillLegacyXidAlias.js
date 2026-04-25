#!/usr/bin/env node
'use strict';

/**
 * One-time backfill for legacy users where xid diverged from canonical xID.
 *
 * Updates only users where:
 * - xID matches canonical X123456 format
 * - xid differs from xID
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const log = require('../utils/log');

const CANONICAL_XID_REGEX = /^X\d{6}$/;

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(uri);

  const filter = {
    xID: { $regex: CANONICAL_XID_REGEX.source },
    $expr: { $ne: ['$xid', '$xID'] },
  };

  const result = await User.updateMany(filter, [
    { $set: { xid: '$xID' } },
  ]);

  log.info('[MIGRATION] Legacy xid alias backfill complete', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[MIGRATION] Failed to backfill legacy xid alias:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // no-op
    }
    process.exit(1);
  });
