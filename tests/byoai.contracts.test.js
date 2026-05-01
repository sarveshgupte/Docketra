#!/usr/bin/env node
const assert = require('assert');

const { evaluateAiPolicy } = require('../src/services/ai/policy/aiPolicy.service');
const { resolveAiCredentials, getSafeCredentialConfig } = require('../src/services/ai/credentials/aiCredentialResolver.service');
const { redactSensitiveText } = require('../src/services/ai/redaction/aiRedaction.service');
const providerRegistry = require('../src/services/ai/providers/providerRegistry');
const { buildMetadataOnlyAuditRecord } = require('../src/services/ai/audit/aiAuditWriter.service');

function testAiDisabledBlocksRequest() {
  const decision = evaluateAiPolicy({ firmId: 'f1', aiEnabled: false });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'AI_DISABLED');
}

function testMissingFirmBlocksRequest() {
  const decision = evaluateAiPolicy({ aiEnabled: true });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'MISSING_FIRM_CONTEXT');
}

function testUnsupportedProviderBlocksRequest() {
  const decision = evaluateAiPolicy({
    firmId: 'f1', aiEnabled: true, featureEnabled: true, roleAllowed: true,
    provider: 'unknown', providerConfigured: true, credentialStatus: 'configured',
  });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'UNSUPPORTED_PROVIDER');
}

async function testMissingCredentialBlocksProviderUsage() {
  const creds = await resolveAiCredentials({ provider: 'openai', firmId: 'f1' });
  assert.strictEqual(creds.status, 'not_configured');
  const decision = evaluateAiPolicy({
    firmId: 'f1', aiEnabled: true, featureEnabled: true, roleAllowed: true,
    provider: 'openai', providerConfigured: true, credentialStatus: creds.status,
  });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'CREDENTIALS_MISSING');
}

function testRoleNotAllowedBlocksRequest() {
  const decision = evaluateAiPolicy({ firmId: 'f1', aiEnabled: true, featureEnabled: true, roleAllowed: false });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'ROLE_NOT_ALLOWED');
}

function testFeatureDisabledBlocksRequest() {
  const decision = evaluateAiPolicy({ firmId: 'f1', aiEnabled: true, featureEnabled: false });
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCode, 'FEATURE_DISABLED');
}

function testRedactionPatterns() {
  const input = 'mail me at a@b.com or +91 9876543210 PAN ABCDE1234F GSTIN 22ABCDE1234F1Z5 Aadhaar 1234 5678 9012';
  const redacted = redactSensitiveText(input);
  assert.ok(!redacted.redactedText.includes('a@b.com'));
  assert.ok(!redacted.redactedText.includes('9876543210'));
  assert.ok(!redacted.redactedText.includes('ABCDE1234F'));
  assert.ok(!redacted.redactedText.includes('22ABCDE1234F1Z5'));
  assert.ok(!redacted.redactedText.includes('1234 5678 9012'));
  assert.ok(redacted.counts.email >= 1);
  assert.ok(redacted.counts.phone >= 1);
  assert.ok(redacted.counts.pan >= 1);
  assert.ok(redacted.counts.gstin >= 1);
  assert.ok(redacted.counts.aadhaar >= 1);
}

function testAuditRejectsRawPromptResponse() {
  assert.throws(() => buildMetadataOnlyAuditRecord({ prompt: 'secret prompt' }), /RAW_AI_CONTENT_NOT_ALLOWED_IN_AUDIT/);
  assert.throws(() => buildMetadataOnlyAuditRecord({ rawResponse: 'secret output' }), /RAW_AI_CONTENT_NOT_ALLOWED_IN_AUDIT/);
}

function testProviderRegistryIsStubMetadataOnly() {
  const providers = providerRegistry.listProviders();
  const ids = providers.map((p) => p.id).sort();
  assert.deepStrictEqual(ids, ['anthropic', 'azure_openai', 'docketra_managed', 'gemini', 'openai']);
  providers.forEach((provider) => {
    assert.strictEqual(typeof providerRegistry.validateProviderConfig(provider.id), 'object');
    assert.strictEqual(typeof providerRegistry.getProviderMetadata(provider.id), 'object');
  });
  assert.strictEqual(providerRegistry.isSupportedProvider('not_real'), false);
}

function testSafeCredentialConfigNoSecrets() {
  const safe = getSafeCredentialConfig({ provider: 'openai', credentialRef: 'ref-1', encryptedKey: 'value' });
  assert.strictEqual(safe.provider, 'openai');
  assert.strictEqual(safe.hasCredentialRef, true);
  assert.strictEqual(safe.hasEncryptedKey, true);
  assert.strictEqual(safe.credentialRef, undefined);
  assert.strictEqual(safe.encryptedKey, undefined);
}

async function run() {
  try {
    testAiDisabledBlocksRequest();
    testMissingFirmBlocksRequest();
    testUnsupportedProviderBlocksRequest();
    await testMissingCredentialBlocksProviderUsage();
    testRoleNotAllowedBlocksRequest();
    testFeatureDisabledBlocksRequest();
    testRedactionPatterns();
    testAuditRejectsRawPromptResponse();
    testProviderRegistryIsStubMetadataOnly();
    testSafeCredentialConfigNoSecrets();
    console.log('BYOAI contract skeleton tests passed.');
  } catch (error) {
    console.error('BYOAI contract skeleton tests failed:', error);
    process.exit(1);
  }
}

run();
