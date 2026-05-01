const { decrypt } = require('../../../security/encryption.service');

function getSafeCredentialConfig(input = {}) {
  return {
    provider: input.provider || null,
    hasCredentialRef: Boolean(input.credentialRef),
    hasEncryptedKey: Boolean(input.encryptedKey),
  };
}

async function resolveAiCredentials({ provider, credentialRef, encryptedKey, firmId, allowStubPlaintext } = {}) {
  if (!provider || !firmId) {
    return { status: 'not_configured', reasonCode: 'MISSING_CONTEXT' };
  }

  if (allowStubPlaintext) {
    return {
      status: 'configured',
      credentialMaterial: '[stubbed]',
      source: 'test_stub',
    };
  }

  if (credentialRef) {
    return {
      status: 'not_configured',
      reasonCode: 'CREDENTIAL_REF_LOOKUP_NOT_IMPLEMENTED',
    };
  }

  if (encryptedKey) {
    try {
      await decrypt(encryptedKey, firmId, 'admin');
      return {
        status: 'not_configured',
        reasonCode: 'ENCRYPTED_KEY_RUNTIME_NOT_IMPLEMENTED',
      };
    } catch (_error) {
      return {
        status: 'not_configured',
        reasonCode: 'CREDENTIAL_DECRYPT_FAILED',
      };
    }
  }

  return { status: 'not_configured', reasonCode: 'MISSING_CREDENTIALS' };
}

module.exports = {
  getSafeCredentialConfig,
  resolveAiCredentials,
};
