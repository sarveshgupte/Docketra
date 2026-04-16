#!/usr/bin/env node
/**
 * Migration: Normalize firmSlug to lowercase for all Firm documents
 *
 * Run once if any firm slugs were stored with mixed or uppercase characters
 * before the schema enforced `lowercase: true`.
 *
 * Usage:
 *   node src/scripts/normalizeSlug.js
 *
 * Safe to re-run — only documents whose slug is not already lowercase are
 * touched.  The unique index on firmSlug is maintained because $toLower
 * of an already-lowercase string is a no-op.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const log = require('../utils/log');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    log.error('[normalizeSlug] MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  log.info('[normalizeSlug] Connected to MongoDB');

  // Use aggregation pipeline update to lowercase all slugs in one operation
  const result = await Firm.updateMany({}, [
    { $set: { firmSlug: { $toLower: '$firmSlug' } } },
  ]);

  log.info(`[normalizeSlug] Done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  log.error('[normalizeSlug] Migration failed:', err);
  process.exit(1);
});
