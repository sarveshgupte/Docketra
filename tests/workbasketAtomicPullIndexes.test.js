#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');

function hasIndex(indexes, keys, options = {}) {
  return indexes.some(([indexKeys, indexOptions]) => {
    const sameKeys = JSON.stringify(indexKeys) === JSON.stringify(keys);
    if (!sameKeys) return false;
    return Object.entries(options).every(([k, v]) => indexOptions?.[k] === v);
  });
}

function run() {
  try {
    const indexes = Case.schema.indexes();

    assert.strictEqual(
      hasIndex(
        indexes,
        { firmId: 1, caseId: 1, status: 1, assignedToXID: 1, assignedTo: 1 }
      ),
      true
    );

    assert.strictEqual(
      hasIndex(indexes, { firmId: 1, caseId: 1 }, { unique: true }),
      true
    );

    console.log('✓ Atomic pull and tenant unique indexes are defined on Case schema');
  } catch (error) {
    console.error('Atomic pull index validation test failed:', error);
    process.exit(1);
  }
}

run();
