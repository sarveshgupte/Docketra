#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const repoAgentService = require('../src/services/superadminRepoAgent.service');
const repoAgentController = require('../src/controllers/superadminRepoAgent.controller');

async function testPathTraversalRejection() {
  console.log('Testing path traversal security in Repo Agent...');

  // 1. Directory traversal attempt
  await assert.rejects(
    async () => {
      await repoAgentService.dispatchCodeTask({
        agent: 'sentinel',
        prompt: 'Check file',
        targetFile: '../../../etc/passwd',
      });
    },
    /Target file must reside within repository root/
  );
  console.log('✓ Directory traversal outside REPO_ROOT successfully blocked');

  // 2. Sensitive file access attempt (.env)
  await assert.rejects(
    async () => {
      await repoAgentService.dispatchCodeTask({
        agent: 'sentinel',
        prompt: 'Check file',
        targetFile: '.env',
      });
    },
    /Access to sensitive configuration files is restricted/
  );
  console.log('✓ Sensitive configuration file (.env) access successfully blocked');

  // 3. Controller 400 validation response
  let statusCode = null;
  let jsonResult = null;
  const mockRes = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  const traversalReq = {
    body: {
      agent: 'sentinel',
      prompt: 'Check file',
      targetFile: '../../../../Windows/win.ini',
    },
    user: { email: 'superadmin@docketra.com' },
  };

  await repoAgentController.dispatchRepoAgentTask(traversalReq, mockRes);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(jsonResult.success, false);
  assert.ok(jsonResult.message.includes('Target file must reside within repository root'));
  console.log('✓ Controller returns HTTP 400 on path traversal attack');
}

async function run() {
  try {
    await testPathTraversalRejection();
    console.log('All Superadmin Repo Agent path traversal security tests passed successfully!');
  } catch (error) {
    console.error('Superadmin Repo Agent security tests failed:', error);
    process.exit(1);
  }
}

run();
