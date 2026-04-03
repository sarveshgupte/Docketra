#!/usr/bin/env node
/*
 * Migration: encrypt_existing_plaintext_fields
 *
 * Purpose:
 * - Encrypt existing plaintext sensitive fields in Case and Client collections.
 * - This fulfills the TODOs scattered across the codebase.
 *
 * Usage:
 *   node scripts/migrations/encrypt_existing_plaintext_fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { looksEncrypted } = require('../../src/security/encryption.utils');
const { encrypt, ensureTenantKey } = require('../../src/security/encryption.service');
const Case = require('../../src/models/Case.model');
const Client = require('../../src/models/Client.model');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

if (!process.env.MASTER_ENCRYPTION_KEY) {
  console.error('❌ MASTER_ENCRYPTION_KEY is required');
  process.exit(1);
}

const BATCH_SIZE = 100;

async function migrateCollection(model, sensitiveFields) {
  const collectionName = model.collection.name;
  console.log(`\nMigrating collection: ${collectionName}`);

  // Find all documents where at least one sensitive field exists and is not null
  const query = {
    $or: sensitiveFields.map(field => ({ [field]: { $exists: true, $ne: null } }))
  };

  const cursor = model.find(query).cursor();
  let batch = [];
  let processedCount = 0;
  let updatedCount = 0;

  for await (const doc of cursor) {
    let needsUpdate = false;
    let updateSet = {};

    for (const field of sensitiveFields) {
      const value = doc[field];
      if (value != null && !looksEncrypted(value)) {
        needsUpdate = true;

        const tenantId = String(doc.firmId);
        await ensureTenantKey(tenantId);
        const encryptedValue = await encrypt(String(value), tenantId);

        updateSet[field] = encryptedValue;
      }
    }

    if (needsUpdate) {
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updateSet }
        }
      });
      updatedCount++;
    }

    processedCount++;

    if (batch.length >= BATCH_SIZE) {
      await model.bulkWrite(batch);
      batch = [];
      console.log(`  Processed ${processedCount} documents, updated ${updatedCount}...`);
    }
  }

  if (batch.length > 0) {
    await model.bulkWrite(batch);
    console.log(`  Processed ${processedCount} documents, updated ${updatedCount}...`);
  }

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

run();
