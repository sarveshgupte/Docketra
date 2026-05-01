import assert from 'node:assert/strict';
import { buildAiConfigurationPayload } from '../src/utils/aiConfiguration.js';

const payload = buildAiConfigurationPayload({
  enabled: true,
  provider: 'openai',
  model: 'gpt-4.1-mini',
  credentialMode: 'encrypted_key',
  encryptedKey: '  ',
  credentialRef: '',
  features: { docketDrafting: true },
  allowedRoles: ['PRIMARY_ADMIN'],
  retention: { zeroRetention: true, savePrompts: false, saveOutputs: false },
});
assert.equal('encryptedKey' in payload, false, 'empty encryptedKey should be omitted');
assert.equal('credentialRef' in payload, false, 'empty credentialRef should be omitted');

const disabledPayload = buildAiConfigurationPayload({ provider: 'disabled', enabled: true, credentialMode: 'encrypted_key', features: {}, allowedRoles: [], retention: {} });
assert.equal(disabledPayload.enabled, false, 'disabled provider should force enabled=false');
assert.equal(disabledPayload.credentialMode, 'none', 'disabled provider should force credentialMode=none');

console.log('aiConfigurationPayload.test.mjs passed');
