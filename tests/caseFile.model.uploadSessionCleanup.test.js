#!/usr/bin/env node
'use strict';

const assert = require('assert');
const CaseFile = require('../src/models/CaseFile.model');

(() => {
  const indexes = CaseFile.schema.indexes();
  const cleanupTtlIndex = indexes.find(([fields]) => Object.prototype.hasOwnProperty.call(fields, 'cleanupAt'));
  assert.ok(cleanupTtlIndex, 'cleanupAt TTL index should exist');
  assert.strictEqual(cleanupTtlIndex[1].expireAfterSeconds, 0, 'cleanupAt TTL should use direct timestamp expiry');

  const attachmentLinkIndex = indexes.find(([fields]) => (
    Object.prototype.hasOwnProperty.call(fields, 'firmId')
    && Object.prototype.hasOwnProperty.call(fields, 'attachmentId')
  ));
  assert.ok(attachmentLinkIndex, 'firmId+attachmentId index should exist');
  assert.strictEqual(attachmentLinkIndex[1].unique, true, 'upload session to attachment link should be unique');
  assert.deepStrictEqual(
    attachmentLinkIndex[1].partialFilterExpression,
    { attachmentId: { $type: 'objectId' } },
    'attachment link uniqueness should only apply to non-null attachment ids'
  );

  console.log('caseFile.model.uploadSessionCleanup test passed');
})();
