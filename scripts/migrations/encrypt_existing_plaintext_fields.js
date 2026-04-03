#!/usr/bin/env node
/*
 * Migration: encrypt_existing_plaintext_fields
 *
 * Purpose:
 * - Encrypt existing plaintext sensitive fields in Case and Client collections.
 * - This fulfills the TODOs scattered across the codebase.
 * - Iterates through existing unencrypted documents and calls `.save()`
 *   to trigger the Mongoose pre-save hooks which handle formatting and encryption.
 *
 * Usage:
 *   node scripts/migrations/encrypt_existing_plaintext_fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { looksEncrypted } = require('../../src/security/encryption.utils');
const Case = require('../../src/models/Case.model');
const Client = require('../../src/models/Client.model');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// When required by tests, don't exit if no URI
if (!MONGO_URI && require.main === module) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

if (!process.env.MASTER_ENCRYPTION_KEY && require.main === module) {
  console.error('❌ MASTER_ENCRYPTION_KEY is required');
  process.exit(1);
}

async function migrateCollection(model, sensitiveFields) {
  const collectionName = model.collection.name;
  console.log(`\nMigrating collection: ${collectionName}`);

  // Find all documents where at least one sensitive field exists and is not null
  const query = {
    $or: sensitiveFields.map(field => ({ [field]: { $exists: true, $ne: null } }))
  };

  // We must include soft-deleted documents so they are encrypted too
  let cursor;
  if (typeof model.find().includeDeleted === 'function') {
    cursor = model.find(query).includeDeleted().cursor();
  } else {
    cursor = model.find(query).cursor();
  }

  let processedCount = 0;
  let updatedCount = 0;

  for await (const doc of cursor) {
    let needsUpdate = false;

    for (const field of sensitiveFields) {
      const value = doc[field];
      if (value != null && !looksEncrypted(String(value))) {
        needsUpdate = true;
        break;
      }
    }

    if (needsUpdate) {
      // By calling save, we trigger the pre-save hooks that handle trimming, lowercasing, and encryption
      await doc.save();
      updatedCount++;
    }

    processedCount++;

    if (processedCount % 100 === 0) {
      console.log(`  Processed ${processedCount} documents, updated ${updatedCount}...`);
    }
  }

  console.log(`  Processed ${processedCount} documents, updated ${updatedCount}...`);
  console.log(`✅ Finished ${collectionName}. Processed: ${processedCount}, Updated: ${updatedCount}`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    console.log('Starting encryption migration...');

    await migrateCollection(Case, ['description']);
    await migrateCollection(Client, ['primaryContactNumber', 'businessEmail']);

    console.log('\nMigration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { migrateCollection };
