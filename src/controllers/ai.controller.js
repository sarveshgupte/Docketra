'use strict';

const Firm = require('../models/Firm.model');
const { resolveStorageContextFromTenantId } = require('../services/tenantIdentity.service');
const { buildSafeAiConfig, applyAiConfigUpdate, validateAiConfigForEnablement, normalizeAiConfig } = require('../services/ai/config/aiConfig.service');
const { resolveAiCredentials } = require('../services/ai/credentials/aiCredentialResolver.service');
const { evaluateAiPolicy, POLICY_VERSION } = require('../services/ai/policy/aiPolicy.service');
const { getProviderMetadata, buildProviderStatus } = require('../services/ai/providers/providerRegistry');
const { writeAiAuditEvent } = require('../services/ai/audit/aiAuditWriter.service');
const log = require('../utils/log');

function normalizeProviderInput(provider) {
  const candidate = String(provider || '').trim().toLowerCase();
  return candidate === 'claude' ? 'anthropic' : candidate;
}

async function getOwnershipFirmIdForWrite(tenantId, path) {
  const tenantContext = await resolveStorageContextFromTenantId(tenantId);
  if (!tenantContext?.ownershipFirmId) {
    log.warn('[AI_SETTINGS] ownership_resolution_failed', { tenantId, path });
    return null;
  }
  return tenantContext.ownershipFirmId;
}

async function getOwnershipFirmIdForRead(tenantId, path) {
  const tenantContext = await resolveStorageContextFromTenantId(tenantId);
  if (tenantContext?.ownershipFirmId) return tenantContext.ownershipFirmId;
  if (tenantId) {
    log.warn('[AI_SETTINGS] ownership_read_fallback_to_tenant', { tenantId, path });
    return tenantId;
  }
  return null;
}

async function getAiConfiguration(req, res) {
  const ownershipFirmId = await getOwnershipFirmIdForRead(req.firmId, req.originalUrl);
  if (!ownershipFirmId) return res.status(400).json({ success: false, message: 'Tenant mapping missing' });

  const firm = await Firm.findById(ownershipFirmId).select('aiConfig').lean();
  const safe = buildSafeAiConfig(firm?.aiConfig || {});
  const providerMetadata = safe.provider ? getProviderMetadata(safe.provider) : null;
  const providerStatus = safe.provider ? buildProviderStatus(safe.provider, { configuredProvider: safe.provider }) : null;
  return res.json({ success: true, configuration: { ...safe, providerMetadata, providerStatus } });
}

async function updateAiConfiguration(req, res) {
  const ownershipFirmId = await getOwnershipFirmIdForWrite(req.firmId, req.originalUrl);
  if (!ownershipFirmId) return res.status(400).json({ success: false, message: 'Tenant mapping missing' });

  const firm = await Firm.findById(ownershipFirmId).select('aiConfig');
  if (!firm) return res.status(404).json({ success: false, message: 'Firm not found' });

  const actor = req.user?._id ? String(req.user._id) : null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'provider') && req.body.provider != null) {
    const candidateProvider = normalizeProviderInput(req.body.provider);
    if (!['openai', 'gemini', 'anthropic', 'azure_openai', 'docketra_managed'].includes(candidateProvider)) {
      return res.status(400).json({ success: false, reasonCode: 'UNSUPPORTED_PROVIDER' });
    }
  }
  const nextConfig = applyAiConfigUpdate(firm.aiConfig || {}, req.body || {}, actor);

  if (nextConfig.enabled) {
    const validation = validateAiConfigForEnablement(nextConfig);
    if (!validation.valid) {
      return res.status(400).json({ success: false, reasonCode: 'ENABLEMENT_VALIDATION_FAILED', failures: validation.failures });
    }
  }

  firm.aiConfig = nextConfig;
  await firm.save();

  await writeAiAuditEvent({
    firmId: String(ownershipFirmId),
    userId: actor,
    feature: 'ai_configuration_update',
    provider: nextConfig.provider,
    model: nextConfig.model,
    status: 'success',
    reasonCode: 'AI_CONFIG_UPDATED',
    policyVersion: POLICY_VERSION,
  });

  return res.json({ success: true, configuration: buildSafeAiConfig(firm.aiConfig || {}) });
}

async function testAiConfiguration(req, res) {
  const ownershipFirmId = await getOwnershipFirmIdForWrite(req.firmId, req.originalUrl);
  if (!ownershipFirmId) return res.status(400).json({ success: false, message: 'Tenant mapping missing' });

  const firm = await Firm.findById(ownershipFirmId).select('aiConfig').lean();
  const normalized = normalizeAiConfig(firm?.aiConfig || {});
  const credentialResult = await resolveAiCredentials({ aiConfig: normalized, firmId: String(ownershipFirmId) });

  const policy = evaluateAiPolicy({
    firmId: String(ownershipFirmId),
    aiEnabled: true,
    featureEnabled: true,
    roleAllowed: true,
    provider: normalized.provider,
    providerConfigured: Boolean(normalized.provider && normalized.model),
    credentialStatus: credentialResult.status,
  });

  const configuredProvider = normalized.provider || null;
  const providerStatus = configuredProvider ? buildProviderStatus(configuredProvider, { configuredProvider }) : null;
  const runtimeSupported = providerStatus ? providerStatus.runtimeSupported : false;
  const success = policy.allowed && runtimeSupported;
  const safeMessage = success
    ? 'Configuration and runtime are available.'
    : (runtimeSupported ? policy.safeMessage : (providerStatus?.disabledReason || 'Provider runtime is unavailable in this environment.'));

  await writeAiAuditEvent({
    firmId: String(ownershipFirmId),
    userId: req.user?._id ? String(req.user._id) : null,
    feature: 'ai_configuration_test',
    provider: normalized.provider,
    model: normalized.model,
    status: success ? 'success' : 'failed',
    reasonCode: success ? 'RUNTIME_AVAILABLE' : (runtimeSupported ? policy.reasonCode : 'PROVIDER_RUNTIME_UNAVAILABLE'),
    policyVersion: policy.policyVersion,
  });

  return res.json({
    success,
    provider: normalized.provider,
    credentialStatus: credentialResult.status,
    reasonCode: success ? 'RUNTIME_AVAILABLE' : (runtimeSupported ? policy.reasonCode : 'PROVIDER_RUNTIME_UNAVAILABLE'),
    safeMessage,
    policyVersion: policy.policyVersion,
    providerStatus,
  });
}

module.exports = {
  getAiConfiguration,
  updateAiConfiguration,
  testAiConfiguration,
};
