#!/usr/bin/env node
const assert = require('assert');

const caseModelPath = require.resolve('../src/models/Case.model');
const repoPath = require.resolve('../src/repositories/CaseRepository');

const originalCaseModel = require.cache[caseModelPath];
const originalRepo = require.cache[repoPath];

let capturedFilter = null;

require.cache[caseModelPath] = {
  exports: {
    updateOne: async (filter) => {
      capturedFilter = filter;
      return { matchedCount: 1 };
    },
  },
};

delete require.cache[repoPath];
const CaseRepository = require('../src/repositories/CaseRepository');

(async () => {
  await CaseRepository.updateStatus(
    'DOCKET-20260527-00001',
    'firm-1',
    'PENDING',
    { pendingReason: 'pending' },
    null,
    'PENDING'
  );

  assert.ok(capturedFilter, 'Expected CaseRepository.updateStatus to call Case.updateOne');
  assert.strictEqual(capturedFilter.firmId, 'firm-1');
  assert.strictEqual(capturedFilter.status, 'PENDING');
  assert.ok(Array.isArray(capturedFilter.$or), 'Expected identifier-aware filter to include caseId/caseNumber alternatives');

  const patterns = capturedFilter.$or.flatMap((entry) => {
    const matcher = entry.caseId?.$in || entry.caseNumber?.$in || [];
    return matcher.map((regex) => String(regex));
  });

  assert.ok(
    patterns.some((value) => value.includes('DOCKET-20260527-00001')),
    'Expected DOCKET-prefixed identifier candidate in filter'
  );
  assert.ok(
    patterns.some((value) => value.includes('CASE-20260527-00001')),
    'Expected CASE-prefixed identifier candidate in filter'
  );
  assert.ok(
    patterns.some((value) => value.includes('20260527-00001')),
    'Expected bare identifier candidate in filter'
  );

  console.log('caseRepositoryStatusIdentifierMatching.test.js passed');
})()
  .finally(() => {
    if (originalCaseModel) require.cache[caseModelPath] = originalCaseModel;
    else delete require.cache[caseModelPath];

    if (originalRepo) require.cache[repoPath] = originalRepo;
    else delete require.cache[repoPath];
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
