import assert from 'node:assert/strict';
import { buildAiConfigurationPayload } from '../src/utils/aiConfiguration.js';

const payload = buildAiConfigurationPayload({
  enabled: true,
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  credentialMode: 'encrypted_key',
  encryptedKey: '  ',
  credentialRef: '',
  features: { docketDrafting: true },
  allowedRoles: ['PRIMARY_ADMIN'],
  retention: { zeroRetention: true, savePrompts: false, saveOutputs: false },
  privacy: { redactErrors: true, verboseLogging: false },
});
assert.equal(payload.provider, 'gemini', 'provider should keep gemini backend enum value');
assert.deepEqual(payload.roleAccess, { PRIMARY_ADMIN: true, ADMIN: false, MANAGER: false, USER: false }, 'payload should output roleAccess object');
assert.deepEqual(payload.retention, { zeroRetention: true, savePrompts: false, saveOutputs: false }, 'retention should include only retention keys');
assert.deepEqual(payload.privacy, { redactErrors: true, verboseLogging: false }, 'privacy should be separate from retention');
assert.equal('encryptedKey' in payload, false, 'empty encryptedKey should be omitted');
assert.equal('credentialRef' in payload, false, 'empty credentialRef should be omitted');

const disabledPayload = buildAiConfigurationPayload({ provider: 'disabled', enabled: true, credentialMode: 'encrypted_key', features: {}, allowedRoles: [], retention: {}, privacy: {} });
assert.equal(disabledPayload.enabled, false, 'disabled provider should force enabled=false');
assert.equal(disabledPayload.credentialMode, 'none', 'disabled provider should force credentialMode=none');

console.log('aiConfigurationPayload.test.mjs passed');
