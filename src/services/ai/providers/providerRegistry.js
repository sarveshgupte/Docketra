const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    id: 'openai',
    label: 'OpenAI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
  }),
  gemini: Object.freeze({
    id: 'gemini',
    label: 'Google Gemini',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
  }),
  anthropic: Object.freeze({
    id: 'anthropic',
    label: 'Anthropic',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
  }),
  azure_openai: Object.freeze({
    id: 'azure_openai',
    label: 'Azure OpenAI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
  }),
  docketra_managed: Object.freeze({
    id: 'docketra_managed',
    label: 'Docketra Managed AI',
    capabilities: Object.freeze(['chat', 'summarization', 'classification']),
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
};
