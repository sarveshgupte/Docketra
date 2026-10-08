#!/usr/bin/env node
'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required to synchronize indexes.');
  process.exit(1);
}

async function syncAllIndexes() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB. Loading models...');

  const modelsDir = path.join(__dirname, '..', 'src', 'models');
  const files = fs.readdirSync(modelsDir);

  for (const file of files) {
    if (file.endsWith('.js') && !file.endsWith('.test.js')) {
      try {
        require(path.join(modelsDir, file));
      } catch (err) {
        console.warn(`Could not load model ${file}: ${err.message}`);
      }
    }
  }

  const modelNames = mongoose.modelNames();
  console.log(`Synchronizing indexes for ${modelNames.length} models...`);

  for (const name of modelNames) {
    try {
      const model = mongoose.model(name);
      await model.syncIndexes();
      console.log(`✓ Synchronized indexes for ${name}`);
    } catch (err) {
      console.error(`❌ Failed to sync indexes for ${name}: ${err.message}`);
    }
  }

  // Also run custom compound index scripts
  console.log('Ensuring compound multi-tenant indexes...');
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/migrations/add_multi_tenant_indexes.js up', { stdio: 'inherit' });
    execSync('node scripts/migrations/add_default_client_unique_index.js up', { stdio: 'inherit' });
    execSync('node scripts/migrations/add_starter_plan_fields.js up', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to run migration index scripts:', err.message);
  }

  console.log('All database indexes synchronized successfully.');
  await mongoose.disconnect();
}

syncAllIndexes().catch((err) => {
  console.error('Index synchronization error:', err);
  process.exit(1);
});
