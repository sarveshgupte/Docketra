#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

function makeRes() {
  return { statusCode: 200, payload: null, status(c){ this.statusCode = c; return this; }, json(p){ this.payload = p; return this; } };
}

async function run() {
  const saved = { aiConfig: { provider: 'openai', model: 'gpt-4o', encryptedKey: 'cipher', credentialRef: 'ref-1' } };
  let resolveCalls = 0;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({
          aiConfig: saved.aiConfig,
          select(){ return this; },
          lean: async () => ({ aiConfig: saved.aiConfig }),
          save: async function(){ saved.aiConfig = this.aiConfig; return this; },
        }),
      };
    }
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'firm-1' }) };
    if (request === '../services/ai/credentials/aiCredentialResolver.service') return { resolveAiCredentials: async ({ aiConfig }) => { resolveCalls += 1; return { status: aiConfig?.provider ? 'configured' : 'not_configured' }; } };
    if (request === '../utils/log') return { warn: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/ai.controller');
  const controller = require('../src/controllers/ai.controller');
  const rbac = require('../src/middleware/rbac.middleware');

  const getRes = makeRes();
  await controller.getAiConfiguration({ firmId: 'tenant-1' }, getRes);
  assert.strictEqual(getRes.statusCode, 200);
  assert.ok(!('encryptedKey' in getRes.payload.configuration));
  assert.ok(!('apiKey' in getRes.payload.configuration));
  assert.strictEqual(getRes.payload.configuration.providerStatus.runtimeSupported, true);

  const putBadRes = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { provider: 'bad' } }, putBadRes);
  assert.strictEqual(putBadRes.statusCode, 400);

  const putClaudeRes = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { provider: 'claude', credentialMode: 'encrypted_key', encryptedKey: 'plain', model: 'claude-3' } }, putClaudeRes);
  assert.strictEqual(putClaudeRes.statusCode, 200);
  assert.strictEqual(putClaudeRes.payload.configuration.provider, 'anthropic');

  const putEnableFail = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { enabled: true, provider: null, model: null, credentialMode: 'none' } }, putEnableFail);
  assert.strictEqual(putEnableFail.statusCode, 400);

  const putRetention = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { retention: { zeroRetention: true, savePrompts: true, saveOutputs: true } } }, putRetention);
  assert.strictEqual(putRetention.payload.configuration.retention.savePrompts, false);
  assert.strictEqual(putRetention.payload.configuration.retention.saveOutputs, false);
  assert.ok(!putRetention.payload.configuration.encryptedKey);
  assert.ok(!putRetention.payload.configuration.credentialRef);

  const putOpenAiRes = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { provider: 'openai', credentialMode: 'encrypted_key', encryptedKey: 'plain', model: 'gpt-4o' } }, putOpenAiRes);
  assert.strictEqual(putOpenAiRes.statusCode, 200);

  const testRes = makeRes();
  await controller.testAiConfiguration({ firmId: 't', user: { _id: 'u1' } }, testRes);
  assert.strictEqual(resolveCalls, 1);
  assert.strictEqual(testRes.payload.success, true);
  assert.strictEqual(testRes.payload.reasonCode, 'RUNTIME_AVAILABLE');
  assert.strictEqual(testRes.payload.providerStatus.runtimeSupported, true);

  const putAnthropicRes = makeRes();
  await controller.updateAiConfiguration({ firmId: 't', user: { _id: 'u1' }, body: { provider: 'anthropic', credentialMode: 'encrypted_key', encryptedKey: 'plain', model: 'claude-3' } }, putAnthropicRes);
  assert.strictEqual(putAnthropicRes.statusCode, 200);

  const testAnthropicRes = makeRes();
  await controller.testAiConfiguration({ firmId: 't', user: { _id: 'u1' } }, testAnthropicRes);
  assert.strictEqual(testAnthropicRes.payload.success, false);
  assert.strictEqual(testAnthropicRes.payload.reasonCode, 'PROVIDER_RUNTIME_UNAVAILABLE');
  assert.strictEqual(testAnthropicRes.payload.providerStatus.runtimeSupported, false);

  const forbid = makeRes();
  let called = false;
  rbac.requireRole(['PRIMARY_ADMIN', 'ADMIN'])({ user: { role: 'USER' } }, forbid, () => { called = true; });
  assert.strictEqual(called, false);
  assert.strictEqual(forbid.statusCode, 403);

  const allowAdmin = makeRes();
  called = false;
  rbac.requireRole(['PRIMARY_ADMIN', 'ADMIN'])({ user: { role: 'ADMIN' } }, allowAdmin, () => { called = true; });
  assert.strictEqual(called, true);

  console.log('aiAdminApiContract.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
