#!/usr/bin/env node
'use strict';

/**
 * Tests for KnowledgeItem controller.
 *
 * Uses module-injection pattern (no DB) consistent with lead.controller.test.js.
 * Covers: create, list, get, update, archive, validation, firm scoping.
 */

const assert = require('assert');
const mongoose = require('mongoose');

// ─── Mock helpers ────────────────────────────────────────────────────────────

let _items = [];
let _saveError = null;

const makeSavedDoc = (data) => {
  const doc = {
    ...data,
    _id: data._id || new mongoose.Types.ObjectId().toString(),
    status: data.status || 'draft',
    tags: data.tags || [],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: async function () {
      if (_saveError) throw _saveError;
      _items = _items.map((i) => (i._id === this._id ? this : i));
      return this;
    },
    toObject: function () {
      // eslint-disable-next-line no-unused-vars
      const { save, toObject, ...plain } = this;
      return plain;
    },
  };
  return doc;
};

const mockKnowledgeItemModel = {
  create: async (data) => {
    const doc = makeSavedDoc(data);
    _items.push(doc);
    return doc;
  },
  find: (filter) => {
    const chain = {
      _filter: filter,
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => _items.filter((i) =>
        String(i.firmId) === String(filter.firmId)
        && (!filter.type || i.type === filter.type)
        && (!filter.status || i.status === filter.status),
      ),
    };
    return chain;
  },
  findOne: (filter) => {
    const found = _items.find(
      (i) =>
        String(i._id) === String(filter._id)
        && String(i.firmId) === String(filter.firmId),
    ) || null;
    // Return a thenable that also supports .lean() chaining
    const chain = {
      lean: () => Promise.resolve(found ? { ...found.toObject() } : null),
      then: (resolve, reject) => Promise.resolve(found).then(resolve, reject),
      catch: (reject) => Promise.resolve(found).catch(reject),
    };
    return chain;
  },
  countDocuments: (filter) =>
    Promise.resolve(_items.filter((i) => String(i.firmId) === String(filter.firmId)).length),
  KNOWLEDGE_ITEM_TYPES: ['sop', 'checklist', 'template', 'note', 'client_instruction', 'process'],
  KNOWLEDGE_ITEM_STATUSES: ['draft', 'active', 'archived'],
};

// Inject mocks before requiring controller
const inject = (target, exportsValue) => {
  const resolved = require.resolve(target);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
};

inject('../src/models/KnowledgeItem.model', mockKnowledgeItemModel);

const {
  createKnowledgeItem,
  listKnowledgeItems,
  getKnowledgeItem,
  updateKnowledgeItem,
  archiveKnowledgeItem,
} = require('../src/controllers/knowledgeItem.controller');

// ─── Test utilities ───────────────────────────────────────────────────────────

const FIRM_A = '507f1f77bcf86cd799439011';
const FIRM_B = '507f1f77bcf86cd799439022';

const makeReqRes = ({ body = {}, params = {}, query = {}, firmId = FIRM_A } = {}) => {
  const req = {
    body,
    params,
    query,
    user: { firmId, xid: 'X000001' },
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  return { req, res };
};

const reset = () => {
  _items = [];
  _saveError = null;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testCreateKnowledgeItem() {
  reset();
  const { req, res } = makeReqRes({
    body: { title: 'Annual Compliance SOP', type: 'sop', tags: ['compliance', 'annual'] },
  });
  await createKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 201, 'should return 201');
  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(res.payload.data.title, 'Annual Compliance SOP');
  assert.strictEqual(res.payload.data.type, 'sop');
  assert.strictEqual(res.payload.data.status, 'draft');
  assert.deepStrictEqual(res.payload.data.tags, ['compliance', 'annual']);
  assert.strictEqual(String(res.payload.data.firmId), FIRM_A, 'firmId must be set from req.user');
  console.log('  ✓ testCreateKnowledgeItem');
}

async function testCreateRejectsMissingTitle() {
  reset();
  const { req, res } = makeReqRes({ body: { type: 'sop' } });
  await createKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 400, 'should 400 on missing title');
  assert.ok(/title/i.test(res.payload.message));
  console.log('  ✓ testCreateRejectsMissingTitle');
}

async function testCreateRejectsInvalidType() {
  reset();
  const { req, res } = makeReqRes({ body: { title: 'Test', type: 'invalid_type' } });
  await createKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 400, 'should 400 on invalid type');
  assert.ok(/type/i.test(res.payload.message));
  console.log('  ✓ testCreateRejectsInvalidType');
}

async function testCreateRejectsInvalidStatus() {
  reset();
  const { req, res } = makeReqRes({ body: { title: 'Test', type: 'note', status: 'published' } });
  await createKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 400, 'should 400 on invalid status');
  assert.ok(/status/i.test(res.payload.message));
  console.log('  ✓ testCreateRejectsInvalidStatus');
}

async function testListKnowledgeItemsFirmScoped() {
  reset();
  // Create items for two firms
  await createKnowledgeItem(
    { body: { title: 'SOP Firm A', type: 'sop' }, user: { firmId: FIRM_A, xid: 'X000001' } },
    { statusCode: 200, status() { return this; }, json() { return this; } },
  );
  await createKnowledgeItem(
    { body: { title: 'Note Firm B', type: 'note' }, user: { firmId: FIRM_B, xid: 'X000002' } },
    { statusCode: 200, status() { return this; }, json() { return this; } },
  );

  const { req, res } = makeReqRes({ firmId: FIRM_A });
  await listKnowledgeItems(req, res);

  assert.strictEqual(res.payload.success, true);
  assert.ok(Array.isArray(res.payload.data), 'data should be an array');
  // Only FIRM_A items
  for (const item of res.payload.data) {
    assert.strictEqual(String(item.firmId), FIRM_A, 'must only return own firm items');
  }
  console.log('  ✓ testListKnowledgeItemsFirmScoped');
}

async function testGetOneItem() {
  reset();
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Template A', type: 'template' },
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;

  const { req, res } = makeReqRes({ params: { id: created._id } });
  await getKnowledgeItem(req, res);

  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(String(res.payload.data._id), String(created._id));
  assert.strictEqual(res.payload.data.title, 'Template A');
  console.log('  ✓ testGetOneItem');
}

async function testGetNotFound() {
  reset();
  const fakeId = new mongoose.Types.ObjectId().toString();
  const { req, res } = makeReqRes({ params: { id: fakeId } });
  await getKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 404);
  console.log('  ✓ testGetNotFound');
}

async function testUpdateAllowedFields() {
  reset();
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Old Title', type: 'note' },
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;

  const { req, res } = makeReqRes({
    params: { id: created._id },
    body: { title: 'New Title', status: 'active', tags: ['updated'] },
  });
  await updateKnowledgeItem(req, res);

  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(res.payload.data.title, 'New Title');
  assert.strictEqual(res.payload.data.status, 'active');
  assert.deepStrictEqual(res.payload.data.tags, ['updated']);
  console.log('  ✓ testUpdateAllowedFields');
}

async function testUpdateRejectsArchivedItem() {
  reset();
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Archived Item', type: 'checklist', status: 'archived' },
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;

  // Directly set archived status on the stored mock
  const stored = _items.find((i) => String(i._id) === String(created._id));
  if (stored) stored.status = 'archived';

  const { req, res } = makeReqRes({
    params: { id: created._id },
    body: { title: 'Should Fail' },
  });
  await updateKnowledgeItem(req, res);

  assert.strictEqual(res.statusCode, 400, 'should reject updates to archived items');
  console.log('  ✓ testUpdateRejectsArchivedItem');
}

async function testArchiveItem() {
  reset();
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Process A', type: 'process', status: 'active' },
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;

  const { req, res } = makeReqRes({ params: { id: created._id } });
  await archiveKnowledgeItem(req, res);

  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(res.payload.data.status, 'archived');
  console.log('  ✓ testArchiveItem');
}

async function testArchiveIdempotent() {
  reset();
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Idempotent Archive', type: 'note', status: 'archived' },
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;
  const stored = _items.find((i) => String(i._id) === String(created._id));
  if (stored) stored.status = 'archived';

  const { req, res } = makeReqRes({ params: { id: created._id } });
  await archiveKnowledgeItem(req, res);

  assert.strictEqual(res.statusCode, 200, 'archiving already-archived should succeed');
  assert.strictEqual(res.payload.data.status, 'archived');
  console.log('  ✓ testArchiveIdempotent');
}

async function testCrossFirmAccessPrevented() {
  reset();
  // Create item for FIRM_A
  const { req: createReq, res: createRes } = makeReqRes({
    body: { title: 'Private SOP', type: 'sop' },
    firmId: FIRM_A,
  });
  await createKnowledgeItem(createReq, createRes);
  const created = createRes.payload.data;

  // Try to access from FIRM_B
  const { req, res } = makeReqRes({
    params: { id: created._id },
    firmId: FIRM_B,
  });
  await getKnowledgeItem(req, res);

  assert.strictEqual(res.statusCode, 404, 'cross-firm access must return 404');
  console.log('  ✓ testCrossFirmAccessPrevented');
}

async function testTagsNormalizedToLowercase() {
  reset();
  const { req, res } = makeReqRes({
    body: { title: 'Tag Test', type: 'note', tags: ['  Compliance ', 'ANNUAL', 'ROC'] },
  });
  await createKnowledgeItem(req, res);
  assert.strictEqual(res.statusCode, 201);
  assert.deepStrictEqual(res.payload.data.tags, ['compliance', 'annual', 'roc']);
  console.log('  ✓ testTagsNormalizedToLowercase');
}

async function testNoAiOrVectorCodePaths() {
  // Confirm no AI/vector/embedding fields exist on created items
  reset();
  const { req, res } = makeReqRes({ body: { title: 'AI Check', type: 'sop' } });
  await createKnowledgeItem(req, res);
  const data = res.payload.data;
  const forbiddenKeys = ['embedding', 'vector', 'aiSummary', 'aiTags', 'llmContext', 'extractedText'];
  for (const key of forbiddenKeys) {
    assert.ok(!(key in data), `KnowledgeItem must not have AI field: ${key}`);
  }
  console.log('  ✓ testNoAiOrVectorCodePaths');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('KnowledgeItem controller tests:');
  const tests = [
    testCreateKnowledgeItem,
    testCreateRejectsMissingTitle,
    testCreateRejectsInvalidType,
    testCreateRejectsInvalidStatus,
    testListKnowledgeItemsFirmScoped,
    testGetOneItem,
    testGetNotFound,
    testUpdateAllowedFields,
    testUpdateRejectsArchivedItem,
    testArchiveItem,
    testArchiveIdempotent,
    testCrossFirmAccessPrevented,
    testTagsNormalizedToLowercase,
    testNoAiOrVectorCodePaths,
  ];

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${test.name}: ${err.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
