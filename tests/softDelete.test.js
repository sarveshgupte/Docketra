#!/usr/bin/env node
const assert = require('assert');
const { softDelete, restoreDocument } = require('../src/services/softDelete.service');

const buildStubQuery = (doc) => ({
  session() {
    return this;
  },
  includeDeleted() {
    return this;
  },
  async exec() {
    return doc;
  },
});

const buildStubModel = (doc) => ({
  modelName: 'Task',
  findOne: () => buildStubQuery(doc),
});

async function testSoftDeleteIdempotent() {
  const doc = {
    deletedAt: null,
    deletedByXID: null,
    deleteReason: null,
    save: async function save() {
      return this;
    },
  };
  const model = buildStubModel(doc);
  const req = { user: { xID: 'X123456' } };

  await softDelete({ model, filter: {}, req, reason: 'test-reason' });
  assert.ok(doc.deletedAt instanceof Date, 'deletedAt should be set');
  assert.strictEqual(doc.deletedByXID, 'X123456');
  assert.strictEqual(doc.deleteReason, 'test-reason');

  // Second delete should be idempotent
  await softDelete({ model, filter: {}, req, reason: 'ignored' });
  assert.strictEqual(doc.deleteReason, 'test-reason', 'reason should not be overwritten on double delete');
}

async function testRestore() {
  const deletedAt = new Date(Date.now() - 1000);
  const doc = {
    deletedAt,
    deletedByXID: 'X000001',
    deleteReason: 'cleanup',
    restoreHistory: [],
    save: async function save() {
      return this;
    },
  };
  const model = buildStubModel(doc);
  const req = { user: { xID: 'X999999' } };

  await restoreDocument({ model, filter: {}, req });
  assert.strictEqual(doc.deletedAt, null, 'deletedAt should be cleared on restore');
  assert.strictEqual(doc.deletedByXID, null, 'deletedByXID should be cleared on restore');
  assert.strictEqual(doc.deleteReason, null, 'deleteReason should be cleared on restore');
  assert.strictEqual(doc.restoreHistory.length, 1, 'restoreHistory should capture restore');
  assert.strictEqual(doc.restoreHistory[0].restoredByXID, 'X999999');
}

async function run() {
  await testSoftDeleteIdempotent();
  await testRestore();
  console.log('Soft delete service tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
