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

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[normalizeSlug] MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[normalizeSlug] Connected to MongoDB');

  // Use aggregation pipeline update to lowercase all slugs in one operation
  const result = await Firm.updateMany({}, [
    { $set: { firmSlug: { $toLower: '$firmSlug' } } },
  ]);

  console.log(`[normalizeSlug] Done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[normalizeSlug] Migration failed:', err);
  process.exit(1);
});
