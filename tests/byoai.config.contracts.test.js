#!/usr/bin/env node
const assert = require('assert');

const { normalizeAiConfig, buildSafeAiConfig, validateAiConfigForEnablement, applyAiConfigUpdate } = require('../src/services/ai/config/aiConfig.service');
const { evaluateAiPolicy } = require('../src/services/ai/policy/aiPolicy.service');
const { resolveAiCredentials } = require('../src/services/ai/credentials/aiCredentialResolver.service');

async function run() {
  const normalized = normalizeAiConfig({});
  assert.strictEqual(normalized.enabled, false);

  const safe = buildSafeAiConfig({ encryptedKey: 'secret', credentialRef: 'ref-1' });
  assert.strictEqual(safe.encryptedKey, undefined);
  assert.strictEqual(safe.credentialRef, undefined);


  const safeLegacy = buildSafeAiConfig({ apiKey: 'legacy', credentialRef: 'ref-1' });
  assert.strictEqual(safeLegacy.apiKey, undefined);
  assert.strictEqual(safeLegacy.encryptedKey, undefined);
  assert.strictEqual(safeLegacy.credentialRef, undefined);

  const claudeNormalized = normalizeAiConfig({ provider: 'claude' });
  assert.strictEqual(claudeNormalized.provider, 'anthropic');

  const retentionConfig = normalizeAiConfig({ retention: { zeroRetention: true, savePrompts: true, saveOutputs: true } });
  assert.strictEqual(retentionConfig.retention.savePrompts, false);
  assert.strictEqual(retentionConfig.retention.saveOutputs, false);

  assert.strictEqual(validateAiConfigForEnablement({ model: 'gpt-4o', credentialMode: 'none' }).valid, false);
  assert.strictEqual(validateAiConfigForEnablement({ provider: 'openai', credentialMode: 'none' }).valid, false);
  assert.strictEqual(validateAiConfigForEnablement({ provider: 'openai', model: 'gpt-4o', credentialMode: 'none' }).valid, false);

  const credByKey = await resolveAiCredentials({ firmId: 'f1', aiConfig: { credentialMode: 'encrypted_key', encryptedKey: 'bad' } });
  assert.strictEqual(credByKey.status, 'configured');
  assert.strictEqual(credByKey.source, 'encrypted_key');
  assert.strictEqual(credByKey.reasonCode, 'ENCRYPTED_KEY_PRESENT_RUNTIME_NOT_ENABLED');
  assert.strictEqual(credByKey.credentialMaterial, undefined);

  const credByLegacyKey = await resolveAiCredentials({ firmId: 'f1', aiConfig: { apiKey: 'legacy-encrypted' } });
  assert.strictEqual(credByLegacyKey.status, 'configured');
  assert.strictEqual(credByLegacyKey.source, 'encrypted_key');

  const credByRef = await resolveAiCredentials({ firmId: 'f1', aiConfig: { credentialMode: 'credential_ref', credentialRef: 'my-ref' } });
  assert.strictEqual(credByRef.source, 'credential_ref');
  assert.strictEqual(credByRef.credentialRef, undefined);

  const updated = applyAiConfigUpdate({}, { retention: { zeroRetention: true, savePrompts: true, saveOutputs: true } }, 'u1');
  assert.strictEqual(updated.retention.savePrompts, false);

  const decision = evaluateAiPolicy({
    firmId: 'f1',
    aiEnabled: normalized.enabled,
    featureEnabled: normalized.features.docketDrafting,
    roleAllowed: normalized.roleAccess.USER,
    provider: normalized.provider,
    providerConfigured: Boolean(normalized.provider),
    credentialStatus: 'not_configured',
  });
  assert.strictEqual(decision.allowed, false);

  const invalidProviderDecision = evaluateAiPolicy({
    firmId: 'f1', aiEnabled: true, featureEnabled: true, roleAllowed: true, provider: 'invalid', providerConfigured: true, credentialStatus: 'configured',
  });
  assert.strictEqual(invalidProviderDecision.allowed, false);

  const roleGateDecision = evaluateAiPolicy({
    firmId: 'f1', aiEnabled: true, featureEnabled: false, roleAllowed: false, provider: 'openai', providerConfigured: true, credentialStatus: 'configured',
  });
  assert.strictEqual(roleGateDecision.allowed, false);

  console.log('byoai.config.contracts.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
