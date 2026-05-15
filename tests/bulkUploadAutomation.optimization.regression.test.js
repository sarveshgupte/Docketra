#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const HANDLER_PATH = path.join(__dirname, '../src/automations/bulkUpload.handlers.js');
const CASE_MODEL_PATH = path.join(__dirname, '../src/models/Case.model.js');
const CATEGORY_MODEL_PATH = path.join(__dirname, '../src/models/Category.model.js');
const SLA_SERVICE_PATH = path.join(__dirname, '../src/services/sla.service.js');

function stubModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  };
}

function resetModules() {
  delete require.cache[HANDLER_PATH];
  delete require.cache[CASE_MODEL_PATH];
  delete require.cache[CATEGORY_MODEL_PATH];
  delete require.cache[SLA_SERVICE_PATH];
}

function makeCategoryStub() {
  return {
    findOne: () => ({
      lean: async () => ({
        _id: 'cat-1',
        name: 'General',
        defaultSlaDays: 3,
        subcategories: [{ id: 'sub-1', name: 'Review', workbasketId: 'wb-1', defaultSlaDays: 5, isActive: true }],
      }),
    }),
  };
}

async function run() {
  let passed = 0;

  async function test(name, fn) {
    resetModules();
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  await test('prefetch skips Case.find on empty/blank client ids and creates nothing', async () => {
    const createCalls = [];
    let findCalled = false;
    stubModule(CASE_MODEL_PATH, {
      find: () => { findCalled = true; return { select: () => ({ lean: async () => [] }) }; },
      create: async (doc) => createCalls.push(doc),
    });
    stubModule(CATEGORY_MODEL_PATH, makeCategoryStub());
    stubModule(SLA_SERVICE_PATH, {
      calculateFallbackDueDateFromDays: () => new Date('2026-01-01T00:00:00.000Z'),
      calculateSlaDueDate: async () => new Date('2026-01-02T00:00:00.000Z'),
    });

    const { handleClientPostCreate } = require(HANDLER_PATH);
    await handleClientPostCreate({
      type: 'clients',
      user: { firmId: 'firm-a', xID: 'x1', email: 'a@test.com' },
      createdClients: [{}, { clientId: '' }, { clientId: '   ' }],
    });

    assert.strictEqual(findCalled, false);
    assert.strictEqual(createCalls.length, 0);
  });

  await test('existing idempotency keys block duplicates while new clients are created', async () => {
    const findQueries = [];
    const created = [];
    stubModule(CASE_MODEL_PATH, {
      find: (query) => {
        findQueries.push(query);
        return { select: () => ({ lean: async () => [{ idempotencyKey: 'automation:bulk-upload:default-docket:firm-a:c1' }] }) };
      },
      create: async (doc) => created.push(doc),
    });
    stubModule(CATEGORY_MODEL_PATH, makeCategoryStub());
    stubModule(SLA_SERVICE_PATH, {
      calculateFallbackDueDateFromDays: () => new Date('2026-01-01T00:00:00.000Z'),
      calculateSlaDueDate: async () => new Date('2026-01-02T00:00:00.000Z'),
    });

    const { handleClientPostCreate } = require(HANDLER_PATH);
    await handleClientPostCreate({
      type: 'clients',
      user: { firmId: 'firm-a', xID: 'x1', email: 'a@test.com' },
      createdClients: [{ clientId: 'c1' }, { clientId: 'c2' }],
    });

    assert.strictEqual(findQueries.length, 1);
    assert.deepStrictEqual(findQueries[0], {
      firmId: 'firm-a',
      idempotencyKey: { $in: ['automation:bulk-upload:default-docket:firm-a:c1', 'automation:bulk-upload:default-docket:firm-a:c2'] },
    });
    assert.strictEqual(created.length, 1);
    assert.strictEqual(created[0].clientId, 'c2');
  });

  await test('SLA lookup failure falls back and does not skip new docket creation', async () => {
    const created = [];
    stubModule(CASE_MODEL_PATH, {
      find: () => ({ select: () => ({ lean: async () => [] }) }),
      create: async (doc) => created.push(doc),
    });
    stubModule(CATEGORY_MODEL_PATH, makeCategoryStub());
    const fallbackDate = new Date('2026-03-01T00:00:00.000Z');
    stubModule(SLA_SERVICE_PATH, {
      calculateFallbackDueDateFromDays: () => fallbackDate,
      calculateSlaDueDate: async () => { throw new Error('temporary SLA read failure'); },
    });

    const { handleClientPostCreate } = require(HANDLER_PATH);
    await handleClientPostCreate({
      type: 'clients',
      user: { firmId: 'firm-a', xID: 'x1', email: 'a@test.com' },
      createdClients: [{ clientId: 'c9' }],
    });

    assert.strictEqual(created.length, 1);
    assert.strictEqual(created[0].dueDate.toISOString(), fallbackDate.toISOString());
  });

  await test('prefetch query remains tenant scoped by firmId', async () => {
    const queries = [];
    stubModule(CASE_MODEL_PATH, {
      find: (query) => {
        queries.push(query);
        return { select: () => ({ lean: async () => [] }) };
      },
      create: async () => ({}),
    });
    stubModule(CATEGORY_MODEL_PATH, makeCategoryStub());
    stubModule(SLA_SERVICE_PATH, {
      calculateFallbackDueDateFromDays: () => new Date('2026-01-01T00:00:00.000Z'),
      calculateSlaDueDate: async () => new Date('2026-01-02T00:00:00.000Z'),
    });

    const { handleClientPostCreate } = require(HANDLER_PATH);
    await handleClientPostCreate({
      type: 'clients',
      user: { firmId: 'firm-tenant-42', xID: 'x1', email: 'a@test.com' },
      createdClients: [{ clientId: 'c1' }],
    });

    assert.strictEqual(queries[0].firmId, 'firm-tenant-42');
    assert.ok(Array.isArray(queries[0].idempotencyKey.$in));
  });

  console.log(`\nPassed ${passed} bulk upload automation regression tests.`);
}

run();
