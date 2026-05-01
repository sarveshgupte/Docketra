function getSafeCredentialConfig(input = {}) {
  return {
    provider: input.provider || null,
    hasCredentialRef: Boolean(input.credentialRef),
    hasEncryptedKey: Boolean(input.encryptedKey || input.apiKey),
  };
}

async function resolveAiCredentials({ aiConfig = {}, firmId, allowStubPlaintext = false } = {}) {
  if (!firmId) {
    return { status: 'not_configured', source: 'none', reasonCode: 'MISSING_FIRM_CONTEXT' };
  }

  if (allowStubPlaintext) {
    return {
      status: 'configured',
      source: 'test_stub',
      reasonCode: 'TEST_STUB_ENABLED',
      credentialMaterial: '[stubbed]',
    };
  }

  const credentialMode = aiConfig?.credentialMode || (aiConfig?.encryptedKey || aiConfig?.apiKey ? 'encrypted_key' : (aiConfig?.credentialRef ? 'credential_ref' : 'none'));

  if (credentialMode === 'credential_ref' && aiConfig?.credentialRef) {
    return { status: 'not_configured', source: 'credential_ref', reasonCode: 'CREDENTIAL_REF_LOOKUP_NOT_IMPLEMENTED' };
  }

  if (credentialMode === 'encrypted_key' && (aiConfig?.encryptedKey || aiConfig?.apiKey)) {
    return { status: 'configured', source: 'encrypted_key', reasonCode: 'ENCRYPTED_KEY_PRESENT_RUNTIME_NOT_ENABLED' };
  }

  return { status: 'not_configured', source: 'none', reasonCode: 'MISSING_CREDENTIALS' };
}

module.exports = {
  getSafeCredentialConfig,
  resolveAiCredentials,
};
