#!/usr/bin/env node
'use strict';

const mongoose = require('mongoose');
const Client = require('../../src/models/Client.model');
const { clientProfileStorageService, SENSITIVE_TOP_LEVEL_FIELDS } = require('../../src/services/clientProfileStorage.service');
const log = require('../../src/utils/log');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';
const BATCH_SIZE = Number(process.env.CLIENT_PROFILE_MIGRATION_BATCH_SIZE || 100);

function hasSensitiveData(client) {
  return SENSITIVE_TOP_LEVEL_FIELDS.some((field) => {
    const value = client[field];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  log.info('[CLIENT_PROFILE_MIGRATION] started', { batchSize: BATCH_SIZE });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const cursor = Client.find({}).cursor();
  const failures = [];

  for await (const client of cursor) {
    try {
      if (client.isDefaultClient === true) {
        skipped += 1;
        continue;
      }

      const alreadyMigrated = client?.profileRef?.provider && Number(client?.profileRef?.version || 0) > 0;
      if (alreadyMigrated && !hasSensitiveData(client)) {
        skipped += 1;
        continue;
      }

      await clientProfileStorageService.migrateClientProfileToStorage({
        firmId: client.firmId,
        client,
        actorXID: 'MIGRATION',
      });

      migrated += 1;
      if (migrated % BATCH_SIZE === 0) {
        log.info('[CLIENT_PROFILE_MIGRATION] progress', { migrated, skipped, failed });
      }
    } catch (error) {
      failed += 1;
      failures.push({ clientId: client.clientId, firmId: String(client.firmId), message: error.message });
      log.error('[CLIENT_PROFILE_MIGRATION] failed_record', {
        clientId: client.clientId,
        firmId: String(client.firmId),
        message: error.message,
      });
    }
  }

  log.info('[CLIENT_PROFILE_MIGRATION] completed', { migrated, skipped, failed });

  if (failures.length) {
    console.error(JSON.stringify({ migrated, skipped, failed, failures }, null, 2));
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('[CLIENT_PROFILE_MIGRATION] fatal', error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
