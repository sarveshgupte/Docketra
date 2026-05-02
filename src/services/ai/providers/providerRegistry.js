const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    id: 'openai',
    label: 'OpenAI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
    runtimeSupported: true,
  }),
  gemini: Object.freeze({
    id: 'gemini',
    label: 'Google Gemini',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
    runtimeSupported: false,
    disabledReason: 'Runtime for Gemini is not available in this deployment.',
  }),
  anthropic: Object.freeze({
    id: 'anthropic',
    label: 'Anthropic',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
    runtimeSupported: false,
    disabledReason: 'Runtime for Anthropic is not available in this deployment.',
  }),
  azure_openai: Object.freeze({
    id: 'azure_openai',
    label: 'Azure OpenAI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
    runtimeSupported: false,
    disabledReason: 'Runtime for Azure OpenAI is not available in this deployment.',
  }),
  docketra_managed: Object.freeze({
    id: 'docketra_managed',
    label: 'Docketra Managed AI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
    runtimeSupported: false,
    disabledReason: 'Managed AI runtime is not available in this deployment.',
  }),
});

function getProviderMetadata(providerId) {
  return PROVIDERS[providerId] || null;
}

function isSupportedProvider(providerId) {
  return Boolean(getProviderMetadata(providerId));
}

function validateProviderConfig(providerId, config = {}) {
  if (!isSupportedProvider(providerId)) {
    return { valid: false, reasonCode: 'UNSUPPORTED_PROVIDER' };
  }

  if (typeof config !== 'object' || config === null) {
    return { valid: false, reasonCode: 'PROVIDER_CONFIG_INVALID' };
  }

  return { valid: true, reasonCode: 'OK' };
}

function listProviders() {
  return Object.values(PROVIDERS);
}

module.exports = {
  getProviderMetadata,
  isSupportedProvider,
  validateProviderConfig,
  listProviders,
  buildProviderStatus,
};


function buildProviderStatus(providerId, { configuredProvider = null } = {}) {
  const metadata = getProviderMetadata(providerId);
  if (!metadata) {
    return { provider: providerId || null, available: false, configured: false, runtimeSupported: false, disabledReason: 'Provider is not supported.' };
  }
  return {
    provider: metadata.id,
    available: true,
    configured: metadata.id === configuredProvider,
    runtimeSupported: metadata.runtimeSupported !== false,
    disabledReason: metadata.runtimeSupported === false ? (metadata.disabledReason || 'Runtime is unavailable.') : null,
  };
}
