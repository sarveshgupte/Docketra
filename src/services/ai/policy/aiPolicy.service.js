const { isSupportedProvider } = require('../providers/providerRegistry');

const POLICY_VERSION = '2026-05-01.byoai-contract-v1';

function deny(reasonCode, safeMessage) {
  return {
    allowed: false,
    reasonCode,
    safeMessage,
    policyVersion: POLICY_VERSION,
  };
}

function evaluateAiPolicy({
  firmId,
  aiEnabled = false,
  featureEnabled = false,
  roleAllowed = false,
  provider,
  providerConfigured = false,
  credentialStatus = 'not_configured',
} = {}) {
  if (!firmId) return deny('MISSING_FIRM_CONTEXT', 'Firm context is required for AI requests.');
  if (!aiEnabled) return deny('AI_DISABLED', 'AI is disabled for this firm.');
  if (!featureEnabled) return deny('FEATURE_DISABLED', 'Requested AI feature is disabled.');
  if (!roleAllowed) return deny('ROLE_NOT_ALLOWED', 'Your role is not allowed to use this AI feature.');
  if (!provider || !isSupportedProvider(provider)) {
    return deny('UNSUPPORTED_PROVIDER', 'The configured AI provider is not supported.');
  }
  if (!providerConfigured) {
    return deny('PROVIDER_NOT_CONFIGURED', 'AI provider is not configured for this firm.');
  }
  if (credentialStatus !== 'configured') {
    return deny('CREDENTIALS_MISSING', 'AI credentials are not configured for this firm.');
  }

  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    safeMessage: 'AI request is allowed by policy.',
    policyVersion: POLICY_VERSION,
  };
}

module.exports = {
  POLICY_VERSION,
  evaluateAiPolicy,
};
