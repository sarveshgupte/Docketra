class AiPolicyDeniedError extends Error {
  constructor(reasonCode, safeMessage) {
    super(safeMessage || 'AI policy denied this request.');
    this.name = 'AiPolicyDeniedError';
    this.reasonCode = reasonCode || 'AI_POLICY_DENIED';
    this.safeMessage = safeMessage || 'AI policy denied this request.';
  }
}

class AiConfigurationError extends Error {
  constructor(reasonCode, safeMessage) {
    super(safeMessage || 'AI provider configuration is invalid.');
    this.name = 'AiConfigurationError';
    this.reasonCode = reasonCode || 'AI_CONFIGURATION_ERROR';
    this.safeMessage = safeMessage || 'AI provider configuration is invalid.';
  }
}

class AiCredentialError extends Error {
  constructor(reasonCode, safeMessage) {
    super(safeMessage || 'AI credentials are unavailable.');
    this.name = 'AiCredentialError';
    this.reasonCode = reasonCode || 'AI_CREDENTIAL_ERROR';
    this.safeMessage = safeMessage || 'AI credentials are unavailable.';
  }
}

module.exports = {
  AiPolicyDeniedError,
  AiConfigurationError,
  AiCredentialError,
};
