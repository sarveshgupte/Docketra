'use strict';

const Firm = require('../models/Firm.model');
const { encrypt } = require('../utils/encryption');

const ALLOWED_PROVIDERS = new Set(['openai', 'gemini', 'claude']);

function isValidApiKeyForProvider(provider, apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) return false;

  if (provider === 'openai') {
    return /^sk-[A-Za-z0-9._-]{10,}$/.test(value);
  }

  if (provider === 'gemini') {
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(value) || value.length >= 20;
  }

  if (provider === 'claude') {
    return /^sk-ant-[A-Za-z0-9_-]{10,}$/.test(value) || value.length >= 20;
  }

  return value.length >= 20;
}

function sanitizeBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return Boolean(value);
}

function normalizeCredentialRef(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isCredentialConfiguredForProvider(aiConfig, provider) {
  if (!provider) return false;
  const selectedProvider = String(provider).toLowerCase();
  const credentialProvider = String(aiConfig?.credentialProvider || '').toLowerCase();
  if (credentialProvider && credentialProvider !== selectedProvider) return false;
  return Boolean(aiConfig?.apiKey || aiConfig?.credentialRef);
}

async function setAiConfig(req, res) {
  const provider = String(req.body?.provider || '').trim().toLowerCase();
  const apiKey = String(req.body?.apiKey || '').trim();
  const model = String(req.body?.model || '').trim();
  const settings = req.body?.settings || {};
  const incomingCredentialRef = normalizeCredentialRef(settings.credentialRef);

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported AI provider' });
  }

  if (apiKey && !isValidApiKeyForProvider(provider, apiKey)) {
    return res.status(400).json({ success: false, message: 'Invalid API key format', code: 'AI_INVALID_API_KEY' });
  }

  const existingFirm = await Firm.findById(req.firmId).select('aiConfig').lean();
  const existingConfig = existingFirm?.aiConfig || {};
  const existingProvider = String(existingConfig?.provider || '').toLowerCase();
  const providerChanged = Boolean(existingProvider && existingProvider !== provider);

  const hasNewCredential = Boolean(apiKey || incomingCredentialRef);
  if (providerChanged && !hasNewCredential) {
    return res.status(400).json({
      success: false,
      code: 'AI_API_KEY_NOT_CONFIGURED',
      message: 'Switching AI provider requires a valid API key or credential reference for the selected provider',
    });
  }

  const updateSet = {
    'aiConfig.enabled': sanitizeBoolean(settings.enabled, hasNewCredential || isCredentialConfiguredForProvider(existingConfig, provider)),
    'aiConfig.provider': provider,
    'aiConfig.model': model || null,
    'aiConfig.enabledFeatures.documentAnalysis': sanitizeBoolean(settings.enabledFeatures?.documentAnalysis, true),
    'aiConfig.enabledFeatures.docketDrafting': sanitizeBoolean(settings.enabledFeatures?.docketDrafting, true),
    'aiConfig.enabledFeatures.routingSuggestions': sanitizeBoolean(settings.enabledFeatures?.routingSuggestions, true),
    'aiConfig.roleAccess.PRIMARY_ADMIN': sanitizeBoolean(settings.roleAccess?.PRIMARY_ADMIN, true),
    'aiConfig.roleAccess.ADMIN': sanitizeBoolean(settings.roleAccess?.ADMIN, true),
    'aiConfig.roleAccess.MANAGER': sanitizeBoolean(settings.roleAccess?.MANAGER, true),
    'aiConfig.roleAccess.USER': sanitizeBoolean(settings.roleAccess?.USER, true),
    'aiConfig.retention.zeroRetention': sanitizeBoolean(settings.retention?.zeroRetention, true),
    'aiConfig.retention.savePrompts': sanitizeBoolean(settings.retention?.savePrompts, false),
    'aiConfig.retention.saveOutputs': sanitizeBoolean(settings.retention?.saveOutputs, false),
    'aiConfig.privacy.redactErrors': sanitizeBoolean(settings.privacy?.redactErrors, true),
    'aiConfig.privacy.verboseLogging': sanitizeBoolean(settings.privacy?.verboseLogging, false),
  };

  const updateUnset = {};

  if (updateSet['aiConfig.retention.zeroRetention']) {
    updateSet['aiConfig.retention.savePrompts'] = false;
    updateSet['aiConfig.retention.saveOutputs'] = false;
  }

  if (providerChanged) {
    updateUnset['aiConfig.apiKey'] = '';
    updateUnset['aiConfig.credentialRef'] = '';
    updateUnset['aiConfig.credentialProvider'] = '';
  }

  if (apiKey) {
    updateSet['aiConfig.apiKey'] = encrypt(apiKey);
    updateSet['aiConfig.credentialProvider'] = provider;
    updateUnset['aiConfig.credentialRef'] = '';
  } else if (incomingCredentialRef) {
    updateSet['aiConfig.credentialRef'] = incomingCredentialRef;
    updateSet['aiConfig.credentialProvider'] = provider;
    updateUnset['aiConfig.apiKey'] = '';
  }

  if (settings.promptTemplates && typeof settings.promptTemplates === 'object') {
    updateSet['aiConfig.promptTemplates'] = settings.promptTemplates;
  }

  const updateDoc = { $set: updateSet };
  if (Object.keys(updateUnset).length) {
    updateDoc.$unset = updateUnset;
  }

  await Firm.findByIdAndUpdate(req.firmId, updateDoc, { new: true, runValidators: true });

  const connected = Boolean(
    (apiKey || incomingCredentialRef)
      ? true
      : isCredentialConfiguredForProvider(existingConfig, provider) && !providerChanged
  );

  return res.json({
    success: true,
    connected,
    credentialConfigured: connected,
    provider,
    model: model || null,
    settings: {
      enabled: updateSet['aiConfig.enabled'],
      enabledFeatures: {
        documentAnalysis: updateSet['aiConfig.enabledFeatures.documentAnalysis'],
        docketDrafting: updateSet['aiConfig.enabledFeatures.docketDrafting'],
        routingSuggestions: updateSet['aiConfig.enabledFeatures.routingSuggestions'],
      },
      roleAccess: {
        PRIMARY_ADMIN: updateSet['aiConfig.roleAccess.PRIMARY_ADMIN'],
        ADMIN: updateSet['aiConfig.roleAccess.ADMIN'],
        MANAGER: updateSet['aiConfig.roleAccess.MANAGER'],
        USER: updateSet['aiConfig.roleAccess.USER'],
      },
      retention: {
        zeroRetention: updateSet['aiConfig.retention.zeroRetention'],
        savePrompts: updateSet['aiConfig.retention.savePrompts'],
        saveOutputs: updateSet['aiConfig.retention.saveOutputs'],
      },
      privacy: {
        redactErrors: updateSet['aiConfig.privacy.redactErrors'],
        verboseLogging: updateSet['aiConfig.privacy.verboseLogging'],
      },
      credentialConfigured: connected,
    },
  });
}

async function getAiConfigStatus(req, res) {
  const firm = await Firm.findById(req.firmId).select('aiConfig').lean();
  const provider = String(firm?.aiConfig?.provider || '').toLowerCase() || null;
  const model = firm?.aiConfig?.model || null;
  const credentialConfigured = isCredentialConfiguredForProvider(firm?.aiConfig || {}, provider);

  return res.json({
    connected: credentialConfigured,
    credentialConfigured,
    provider,
    model,
    settings: {
      enabled: firm?.aiConfig?.enabled === true,
      enabledFeatures: {
        documentAnalysis: firm?.aiConfig?.enabledFeatures?.documentAnalysis !== false,
        docketDrafting: firm?.aiConfig?.enabledFeatures?.docketDrafting !== false,
        routingSuggestions: firm?.aiConfig?.enabledFeatures?.routingSuggestions !== false,
      },
      roleAccess: {
        PRIMARY_ADMIN: firm?.aiConfig?.roleAccess?.PRIMARY_ADMIN !== false,
        ADMIN: firm?.aiConfig?.roleAccess?.ADMIN !== false,
        MANAGER: firm?.aiConfig?.roleAccess?.MANAGER !== false,
        USER: firm?.aiConfig?.roleAccess?.USER !== false,
      },
      retention: {
        zeroRetention: firm?.aiConfig?.retention?.zeroRetention !== false,
        savePrompts: Boolean(firm?.aiConfig?.retention?.savePrompts),
        saveOutputs: Boolean(firm?.aiConfig?.retention?.saveOutputs),
      },
      privacy: {
        redactErrors: firm?.aiConfig?.privacy?.redactErrors !== false,
        verboseLogging: Boolean(firm?.aiConfig?.privacy?.verboseLogging),
      },
      credentialConfigured,
      credentialSource: firm?.aiConfig?.apiKey ? 'apiKey' : (firm?.aiConfig?.credentialRef ? 'credentialRef' : null),
    },
  });
}

async function removeAiConfig(req, res) {
  await Firm.findByIdAndUpdate(req.firmId, {
    $unset: {
      'aiConfig.apiKey': '',
      'aiConfig.model': '',
      'aiConfig.credentialRef': '',
      'aiConfig.credentialProvider': '',
    },
    $set: {
      'aiConfig.enabled': false,
      'aiConfig.provider': null,
      'aiConfig.retention.zeroRetention': true,
      'aiConfig.retention.savePrompts': false,
      'aiConfig.retention.saveOutputs': false,
    },
  });

  return res.json({ success: true, connected: false, credentialConfigured: false, enabled: false });
}

module.exports = {
  setAiConfig,
  getAiConfigStatus,
  removeAiConfig,
};
