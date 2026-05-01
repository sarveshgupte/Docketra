'use strict';

const { isSupportedProvider } = require('../providers/providerRegistry');

const ALLOWED_PROVIDERS = Object.freeze(['openai', 'gemini', 'anthropic', 'azure_openai', 'docketra_managed']);
const ALLOWED_CREDENTIAL_MODES = Object.freeze(['none', 'encrypted_key', 'credential_ref']);

const DEFAULT_AI_CONFIG = Object.freeze({
  enabled: false,
  provider: null,
  model: null,
  credentialMode: 'none',
  encryptedKey: null,
  credentialRef: null,
  features: {
    taskDescriptionRefinement: false,
    documentSummary: false,
    docketDrafting: false,
    routingSuggestions: false,
  },
  roleAccess: {
    PRIMARY_ADMIN: true,
    ADMIN: true,
    MANAGER: false,
    USER: false,
  },
  retention: {
    zeroRetention: true,
    savePrompts: false,
    saveOutputs: false,
  },
  privacy: {
    redactErrors: true,
    verboseLogging: false,
  },
  updatedAt: null,
  updatedBy: null,
});


function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base = {}, updates = {}) {
  const result = { ...base };
  Object.keys(updates || {}).forEach((key) => {
    const updateValue = updates[key];
    const baseValue = base ? base[key] : undefined;
    if (isPlainObject(baseValue) && isPlainObject(updateValue)) {
      result[key] = deepMerge(baseValue, updateValue);
      return;
    }
    result[key] = updateValue;
  });
  return result;
}

function normalizeProvider(provider) {
  if (provider == null) return null;
  const value = String(provider).trim().toLowerCase();
  const canonical = value === 'claude' ? 'anthropic' : value;
  return ALLOWED_PROVIDERS.includes(canonical) ? canonical : null;
}

function normalizeAiConfig(rawConfig = {}) {
  const provider = normalizeProvider(rawConfig.provider);
  const credentialMode = ALLOWED_CREDENTIAL_MODES.includes(rawConfig.credentialMode)
    ? rawConfig.credentialMode
    : (rawConfig.encryptedKey ? 'encrypted_key' : (rawConfig.credentialRef ? 'credential_ref' : 'none'));

  const retention = {
    zeroRetention: rawConfig?.retention?.zeroRetention !== false,
    savePrompts: Boolean(rawConfig?.retention?.savePrompts),
    saveOutputs: Boolean(rawConfig?.retention?.saveOutputs),
  };
  if (retention.zeroRetention) {
    retention.savePrompts = false;
    retention.saveOutputs = false;
  }

  return {
    ...DEFAULT_AI_CONFIG,
    enabled: rawConfig?.enabled === true,
    provider,
    model: rawConfig?.model ? String(rawConfig.model).trim() : null,
    credentialMode,
    encryptedKey: rawConfig?.encryptedKey || rawConfig?.apiKey || null,
    credentialRef: rawConfig?.credentialRef ? String(rawConfig.credentialRef).trim() : null,
    features: {
      ...DEFAULT_AI_CONFIG.features,
      ...(rawConfig?.features || {}),
      documentSummary: rawConfig?.features?.documentSummary === true
        || rawConfig?.enabledFeatures?.documentAnalysis === true,
      docketDrafting: rawConfig?.features?.docketDrafting === true
        || rawConfig?.enabledFeatures?.docketDrafting === true,
      routingSuggestions: rawConfig?.features?.routingSuggestions === true
        || rawConfig?.enabledFeatures?.routingSuggestions === true,
    },
    roleAccess: {
      ...DEFAULT_AI_CONFIG.roleAccess,
      ...(rawConfig?.roleAccess || {}),
    },
    retention,
    privacy: {
      ...DEFAULT_AI_CONFIG.privacy,
      ...(rawConfig?.privacy || {}),
    },
    updatedAt: rawConfig?.updatedAt || null,
    updatedBy: rawConfig?.updatedBy || null,
  };
}

function buildSafeAiConfig(rawConfig = {}) {
  const normalized = normalizeAiConfig(rawConfig);
  return {
    enabled: normalized.enabled,
    provider: normalized.provider,
    model: normalized.model,
    credentialMode: normalized.credentialMode,
    credentialStatus: normalized.encryptedKey || normalized.credentialRef ? 'configured' : 'not_configured',
    hasEncryptedKey: Boolean(normalized.encryptedKey),
    hasCredentialRef: Boolean(normalized.credentialRef),
    features: normalized.features,
    roleAccess: normalized.roleAccess,
    retention: normalized.retention,
    privacy: normalized.privacy,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
  };
}

function validateAiConfigForEnablement(rawConfig = {}) {
  const normalized = normalizeAiConfig(rawConfig);
  const failures = [];
  if (!normalized.provider || !isSupportedProvider(normalized.provider)) failures.push({ field: 'provider', reasonCode: 'PROVIDER_REQUIRED' });
  if (!normalized.model) failures.push({ field: 'model', reasonCode: 'MODEL_REQUIRED' });
  const hasCreds = (normalized.credentialMode === 'encrypted_key' && normalized.encryptedKey)
    || (normalized.credentialMode === 'credential_ref' && normalized.credentialRef);
  if (!hasCreds) failures.push({ field: 'credentials', reasonCode: 'CREDENTIALS_REQUIRED' });
  return { valid: failures.length === 0, failures, normalizedConfig: normalized };
}

function applyAiConfigUpdate(existingConfig = {}, updatePayload = {}, actor = null) {
  const baseConfig = normalizeAiConfig(existingConfig);
  const mergedUpdate = deepMerge(baseConfig, updatePayload || {});
  const merged = normalizeAiConfig(mergedUpdate);
  merged.updatedAt = new Date();
  merged.updatedBy = actor || null;
  return merged;
}

module.exports = { normalizeAiConfig, buildSafeAiConfig, validateAiConfigForEnablement, applyAiConfigUpdate, ALLOWED_PROVIDERS };
