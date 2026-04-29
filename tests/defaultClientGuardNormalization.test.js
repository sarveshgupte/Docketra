#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try { delete require.cache[require.resolve(modulePath)]; } catch (_) {}
};

async function run() {
  let queriedFirmId = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        findOne: (query) => ({
          session() { return this; },
          then(resolve) {
            queriedFirmId = query.firmId;
            return Promise.resolve(resolve({ _id: 'client-1', firmId: query.firmId, isDefaultClient: true }));
          },
        }),
        findOneAndUpdate: async () => ({ _id: 'client-2', firmId: queriedFirmId, isDefaultClient: true }),
      };
    }
    if (request === './clientIdGenerator') {
      return { generateNextClientId: async () => 'C000001' };
    }
    if (request === './tenantIdentity.service') {
      return { resolveClientOwnershipFirmId: async (firmId) => firmId };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/defaultClient.guard');
  const { getOrCreateDefaultClient } = require('../src/services/defaultClient.guard');

  const populatedFirmDoc = { _id: { toString: () => '507f1f77bcf86cd799439011' }, firmId: 'FIRM001' };
  const result = await getOrCreateDefaultClient(populatedFirmDoc, { firmName: 'Acme' });

  assert.strictEqual(queriedFirmId, '507f1f77bcf86cd799439011', 'guard must normalize populated firm doc to Mongo id string');
  assert.strictEqual(String(result.firmId), '507f1f77bcf86cd799439011');

  await assert.rejects(
    () => getOrCreateDefaultClient('[object Object]'),
    /firmId is required to get or create the default client/
  );

  console.log('defaultClientGuardNormalization.test.js passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
