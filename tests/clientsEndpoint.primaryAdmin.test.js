#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const controllerPath = require.resolve('../src/controllers/client.controller');
const repoPath = require.resolve('../src/repositories/ClientRepository');
const firmPath = require.resolve('../src/models/Firm.model');
const defaultClientServicePath = require.resolve('../src/services/defaultClient.service');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

const restoreSwaps = () => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[controllerPath];
};

(async () => {
  swap(repoPath, {
    find: async () => [],
    count: async () => 0,
  });

  swap(firmPath, {
    findById: () => ({ select: () => ({ lean: async () => null }) }),
  });

  swap(defaultClientServicePath, {
    ensureDefaultClientForFirm: async () => null,
  });

  delete require.cache[controllerPath];
  const { getClients } = require('../src/controllers/client.controller');

  const app = express();
  app.use((req, _res, next) => {
    req.user = { firmId: '507f1f77bcf86cd799439011', role: 'PRIMARY_ADMIN', _id: 'user-1' };
    req.ownershipFirmId = '507f1f77bcf86cd799439011';
    next();
  });
  app.get('/api/clients', getClients);

  const res = await request(app).get('/api/clients?activeOnly=false&page=1&limit=25');

  assert.strictEqual(res.status, 200, 'GET /api/clients should return 200 for authenticated primary admin');
  assert.ok(Array.isArray(res.body.data), 'data must be an array');
  assert.ok(Array.isArray(res.body.clients), 'clients must be an array');
  assert.strictEqual(res.body.data.length, 0, 'data should be empty in empty-state');
  assert.strictEqual(res.body.clients.length, 0, 'clients should be empty in empty-state');
  assert.deepStrictEqual(res.body.pagination, { page: 1, limit: 25, total: 0, pages: 1 }, 'pagination should include empty-state metadata');

  console.log('clientsEndpoint.primaryAdmin.test.js passed');
  restoreSwaps();
  process.exit(0);
})().catch((error) => {
  restoreSwaps();
  console.error(error);
  process.exit(1);
});
