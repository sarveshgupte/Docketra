#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');

try {
  const migration = fs.readFileSync('scripts/migrations/add_multi_tenant_indexes.js', 'utf8');
  const dbConfig = fs.readFileSync('src/config/database.js', 'utf8');

  // Condition 1: Partial index uses canonical CaseStatus constants (not raw legacy strings)
  assert.ok(migration.includes('CaseStatus.RESOLVED'));
  assert.ok(migration.includes('CaseStatus.CLOSED'));
  assert.ok(!migration.includes("status: { $ne: 'RESOLVED' }"));

  // Condition 2: autoIndex disabled in production
  assert.ok(dbConfig.includes("autoIndex: process.env.NODE_ENV !== 'production'"));

  console.log('✓ Index migration guardrails verified (status consistency + autoIndex production behavior)');
} catch (error) {
  console.error('Index migration guardrails test failed:', error);
  process.exit(1);
}
