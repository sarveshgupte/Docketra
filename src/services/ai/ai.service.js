'use strict';

const Firm = require('../../models/Firm.model');
const AiAuditLog = require('../../models/AiAuditLog.model');
const { decrypt } = require('../../utils/encryption');
const { normalizeRole } = require('../../utils/role.utils');
const log = require('../../utils/log');
const openAiProvider = require('./providers/openai.provider');
const geminiProvider = require('./providers/gemini.provider');
const claudeProvider = require('./providers/claude.provider');

const providers = {
  openai: openAiProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
};

const DEFAULT_FEATURE_FLAGS = Object.freeze({
  documentAnalysis: true,
  docketDrafting: true,
  routingSuggestions: true,
});

const DEFAULT_ROLE_ACCESS = Object.freeze({
  PRIMARY_ADMIN: true,
  ADMIN: true,
  MANAGER: true,
  USER: true,
});

function buildServiceError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function resolveSystemModel(providerName) {
  if (providerName === 'gemini') return process.env.GEMINI_MODEL || null;
  if (providerName === 'claude') return process.env.CLAUDE_MODEL || null;
  return process.env.OPENAI_MODEL || null;
}

function resolveVerboseLoggingEnabled(aiConfig = {}) {
  return Boolean(aiConfig?.privacy?.verboseLogging);
}

function sanitizeErrorForAudit(error, redactErrors = true) {
  const base = {
    code: String(error?.code || 'AI_REQUEST_FAILED'),
    status: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
  };

  if (!redactErrors) {
    return {
      ...base,
      message: String(error?.message || 'AI request failed').slice(0, 180),
      provider: String(error?.provider || '').toLowerCase() || null,
    };
  }

  return base;
}

function resolveTokenUsage(meta = {}) {
  return {
    inputTokens: Number.isFinite(Number(meta?.tokenUsage?.inputTokens)) ? Number(meta.tokenUsage.inputTokens) : 0,
    outputTokens: Number.isFinite(Number(meta?.tokenUsage?.outputTokens)) ? Number(meta.tokenUsage.outputTokens) : 0,
    totalTokens: Number.isFinite(Number(meta?.tokenUsage?.totalTokens)) ? Number(meta.tokenUsage.totalTokens) : 0,
  };
}

async function writeAuditLog(entry) {
  try {
    await AiAuditLog.create(entry);
  } catch (error) {
    log.warn('[AI] audit_log_write_failed', {
      requestId: entry?.requestId || null,
      firmId: entry?.firmId || null,
      message: String(error?.message || 'audit_write_failed').slice(0, 160),
    });
  }
}

function isFeatureEnabledForRole(aiConfig, userRole) {
  if (!userRole) return true;
  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) return true;
  const roleAccess = {
    ...DEFAULT_ROLE_ACCESS,
    ...(aiConfig?.roleAccess || {}),
  };
  if (!Object.prototype.hasOwnProperty.call(roleAccess, normalizedRole)) return true;
  return Boolean(roleAccess[normalizedRole]);
}

function isFeatureEnabled(aiConfig, featureName) {
  if (!featureName) return true;
  const enabledFeatures = {
    ...DEFAULT_FEATURE_FLAGS,
    ...(aiConfig?.enabledFeatures || {}),
  };
  if (!Object.prototype.hasOwnProperty.call(enabledFeatures, featureName)) return true;
  return Boolean(enabledFeatures[featureName]);
}

function hasFirmCredentialConfigured(aiConfig = {}, providerName = null) {
  const credentialProvider = String(aiConfig?.credentialProvider || '').toLowerCase();
  const expectedProvider = String(providerName || aiConfig?.provider || '').toLowerCase();
  if (!expectedProvider) return false;
  if (credentialProvider && credentialProvider !== expectedProvider) return false;
  return Boolean(aiConfig?.apiKey || aiConfig?.credentialRef);
}

function resolveApiKey(aiConfig = {}, providerName = null) {
  const expectedProvider = String(providerName || aiConfig?.provider || '').toLowerCase();
  const credentialProvider = String(aiConfig?.credentialProvider || '').toLowerCase();
  if (!aiConfig?.apiKey) return null;
  if (credentialProvider && expectedProvider && credentialProvider !== expectedProvider) {
    return null;
  }
  return decrypt(aiConfig.apiKey);
}

async function executeAiOperation({
  firmId,
  featureName,
  operation,
  payload,
  requestId = null,
  userRole = null,
}) {
  const firm = await Firm.findById(firmId).select('aiConfig').lean();
  const aiConfig = firm?.aiConfig || {};
  const isFirmAiEnabled = aiConfig?.enabled === true;

  if (!isFirmAiEnabled) {
    throw buildServiceError('AI_DISABLED_FOR_FIRM', 'AI is disabled for this firm');
  }

  if (!isFeatureEnabled(aiConfig, featureName)) {
    throw buildServiceError('AI_FEATURE_DISABLED', `AI feature is disabled: ${featureName}`);
  }

  if (!isFeatureEnabledForRole(aiConfig, userRole)) {
    throw buildServiceError('AI_ROLE_NOT_ALLOWED', 'Your role is not allowed to use this AI feature');
  }

  const providerName = String(aiConfig?.provider || '').toLowerCase();
  if (!providerName) {
    throw buildServiceError('AI_PROVIDER_NOT_CONFIGURED', 'AI provider is not configured for this firm');
  }

  const provider = providers[providerName];
  if (!provider || typeof provider[operation] !== 'function') {
    throw buildServiceError('AI_PROVIDER_NOT_CONFIGURED', `Unsupported AI provider: ${providerName}`);
  }

  if (!hasFirmCredentialConfigured(aiConfig, providerName)) {
    throw buildServiceError('AI_API_KEY_NOT_CONFIGURED', 'AI credentials are not configured for this provider');
  }

  const apiKey = resolveApiKey(aiConfig, providerName);
  if (!apiKey) {
    throw buildServiceError('AI_API_KEY_NOT_CONFIGURED', 'Encrypted AI API key is not available for this provider');
  }

  const model = String(aiConfig?.model || '').trim() || resolveSystemModel(providerName) || null;
  const start = Date.now();
  const redactErrors = aiConfig?.privacy?.redactErrors !== false;
  let providerMeta = null;

  try {
    const result = await provider[operation](payload, { apiKey, model, firmId });
    providerMeta = result?._providerMeta || null;

    await writeAuditLog({
      firmId,
      requestId,
      featureName,
      provider: providerName,
      model,
      status: 'SUCCESS',
      latencyMs: Date.now() - start,
      tokenUsage: resolveTokenUsage(providerMeta),
      error: null,
      verboseMetadata: resolveVerboseLoggingEnabled(aiConfig) ? { providerRequestId: providerMeta?.providerRequestId || null } : {},
    });

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const { _providerMeta, ...safeResult } = result;
      return safeResult;
    }

    return result;
  } catch (error) {
    await writeAuditLog({
      firmId,
      requestId,
      featureName,
      provider: providerName,
      model,
      status: 'FAILED',
      latencyMs: Date.now() - start,
      tokenUsage: resolveTokenUsage(providerMeta),
      error: sanitizeErrorForAudit(error, redactErrors),
      verboseMetadata: resolveVerboseLoggingEnabled(aiConfig) ? { providerRequestId: providerMeta?.providerRequestId || null } : {},
    });

    if (!error.code) {
      error.code = 'AI_REQUEST_FAILED';
    }
    throw error;
  }
}

async function analyzeDocument(text, firmId, options = {}) {
  const isAiEnabled = String(process.env.ENABLE_AI_ANALYSIS || 'false').toLowerCase() === 'true';
  if (!isAiEnabled) {
    throw buildServiceError('AI_FEATURE_DISABLED', 'AI analysis is disabled');
  }

  return executeAiOperation({
    firmId,
    featureName: 'documentAnalysis',
    operation: 'analyze',
    payload: text,
    requestId: options.requestId || null,
    userRole: options.userRole || null,
  });
}

async function generateDocketFields(input, firmId, options = {}) {
  const isAiEnabled = String(process.env.ENABLE_AI_DOCKET_CREATION || 'true').toLowerCase() === 'true';
  if (!isAiEnabled) {
    throw buildServiceError('AI_FEATURE_DISABLED', 'AI docket creation is disabled');
  }

  return executeAiOperation({
    firmId,
    featureName: 'docketDrafting',
    operation: 'generateDocketFields',
    payload: input,
    requestId: options.requestId || null,
    userRole: options.userRole || null,
  });
}

module.exports = {
  analyzeDocument,
  generateDocketFields,
};
