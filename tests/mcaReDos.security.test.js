#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { mcaBulkIngestionService } = require('../src/services/mcaBulkIngestion.service');
const { escapeRegExp } = require('../src/utils/regexp.utils');
const McaCompanyDirectory = require('../src/models/McaCompanyDirectory.model');

async function testMcaSearchReDosSafety() {
  console.log('Testing ReDoS and regex special-character safety in MCA Autocomplete...');

  const originalFind = McaCompanyDirectory.find;
  const mongoose = require('mongoose');
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  let capturedFilter = null;

  McaCompanyDirectory.find = (filter) => {
    capturedFilter = filter;
    return {
      select: () => ({
        limit: () => ({
          lean: async () => [],
        }),
      }),
    };
  };

  try {
    // 1. Search with unclosed parenthesis and brackets that would fail if unescaped
    const maliciousQuery = 'TATA (INDIA) [PVT] + & ^ $ * ?';
    await mcaBulkIngestionService.searchDirectory({ query: maliciousQuery, limit: 10 });

    assert.ok(capturedFilter, 'Filter must be generated');
    assert.ok(capturedFilter.$or, 'Must use $or filter for company/cin search');

    // Verify regex has escaped parentheses and brackets
    const companyNameRegexStr = capturedFilter.$or[0].companyName.$regex;
    assert.ok(
      companyNameRegexStr.includes('\\(') && companyNameRegexStr.includes('\\[') && companyNameRegexStr.includes('\\*'),
      'Regex string must properly escape regex metacharacters'
    );

    // Verify constructing a real RegExp from the string does not throw syntax error
    const compiled = new RegExp(companyNameRegexStr, capturedFilter.$or[0].companyName.$options);
    assert.strictEqual(compiled.test('^TATA (INDIA) [PVT] + & ^ $ * ?'), false);
    assert.strictEqual(compiled.test('TATA (INDIA) [PVT] + & ^ $ * ? LIMITED'), true);

    console.log('✓ MCA search successfully escapes metacharacters and prevents ReDoS');
  } finally {
    McaCompanyDirectory.find = originalFind;
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
  }
}

async function run() {
  try {
    await testMcaSearchReDosSafety();
    console.log('All MCA ReDoS and regex safety tests passed successfully!');
  } catch (error) {
    console.error('MCA ReDoS safety tests failed:', error);
    process.exit(1);
  }
}

run();
