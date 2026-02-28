#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');
const CaseHistory = require('../src/models/CaseHistory.model');

function hasIndex(indexes, keys) {
  return indexes.some(([idx]) => JSON.stringify(idx) === JSON.stringify(keys));
}

try {
  const caseIndexes = Case.schema.indexes();
  const historyIndexes = CaseHistory.schema.indexes();

  assert.ok(hasIndex(caseIndexes, { firmId: 1, status: 1, dueDate: 1 }));
  assert.ok(hasIndex(caseIndexes, { firmId: 1, assignedToXID: 1, status: 1 }));
  assert.ok(hasIndex(caseIndexes, { firmId: 1, status: 1, createdAt: -1 }));

  assert.ok(hasIndex(historyIndexes, { firmId: 1, caseId: 1, timestamp: -1 }));

  console.log('✓ Multi-tenant index strategy indexes are defined on schemas');
} catch (error) {
  console.error('Multi-tenant index strategy test failed:', error);
  process.exit(1);
}
