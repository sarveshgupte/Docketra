'use strict';

const Firm = require('../models/Firm.model');
const { resolveStorageContextFromTenantId } = require('../services/tenantIdentity.service');
const { buildSafeAiConfig, applyAiConfigUpdate, validateAiConfigForEnablement, normalizeAiConfig } = require('../services/ai/config/aiConfig.service');
const { resolveAiCredentials } = require('../services/ai/credentials/aiCredentialResolver.service');
const { evaluateAiPolicy, POLICY_VERSION } = require('../services/ai/policy/aiPolicy.service');
const { getProviderMetadata } = require('../services/ai/providers/providerRegistry');
const { writeAiAuditEvent } = require('../services/ai/audit/aiAuditWriter.service');
const log = require('../utils/log');

async function getOwnershipFirmId(tenantId, path) {
  const tenantContext = await resolveStorageContextFromTenantId(tenantId);
  if (!tenantContext?.ownershipFirmId) {
    log.warn('[AI_SETTINGS] ownership_resolution_failed', { tenantId, path });
    return null;
  }
  return tenantContext.ownershipFirmId;
}

async function getAiConfiguration(req, res) {
  const ownershipFirmId = await getOwnershipFirmId(req.firmId, req.originalUrl);
  if (!ownershipFirmId) return res.status(400).json({ success: false, message: 'Tenant mapping missing' });

  const firm = await Firm.findById(ownershipFirmId).select('aiConfig').lean();
  const safe = buildSafeAiConfig(firm?.aiConfig || {});
  const providerMetadata = safe.provider ? getProviderMetadata(safe.provider) : null;
  return res.json({ success: true, configuration: { ...safe, providerMetadata } });
}

async function updateAiConfiguration(req, res) {
  const ownershipFirmId = await getOwnershipFirmId(req.firmId, req.originalUrl);
  if (!ownershipFirmId) return res.status(400).json({ success: false, message: 'Tenant mapping missing' });

  const firm = await Firm.findById(ownershipFirmId).select('aiConfig');
  if (!firm) return res.status(404).json({ success: false, message: 'Firm not found' });

  const actor = req.user?._id ? String(req.user._id) : null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'provider') && req.body.provider != null) {
    const candidateProvider = String(req.body.provider).trim().toLowerCase();
    if (!['openai', 'gemini', 'anthropic', 'azure_openai', 'docketra_managed', 'claude'].includes(candidateProvider)) {
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
  const ownershipFirmId = await getOwnershipFirmId(req.firmId, req.originalUrl);
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

  const success = policy.allowed;
  const safeMessage = success
    ? 'Configuration shape is valid. Runtime provider validation is not implemented yet.'
    : policy.safeMessage;

  await writeAiAuditEvent({
    firmId: String(ownershipFirmId),
    userId: req.user?._id ? String(req.user._id) : null,
    feature: 'ai_configuration_test',
    provider: normalized.provider,
    model: normalized.model,
    status: success ? 'success' : 'failed',
    reasonCode: success ? 'CONFIG_SHAPE_VALID' : policy.reasonCode,
    policyVersion: policy.policyVersion,
  });

  return res.json({
    success,
    provider: normalized.provider,
    credentialStatus: credentialResult.status,
    reasonCode: success ? 'CONFIG_SHAPE_VALID' : policy.reasonCode,
    safeMessage,
    policyVersion: policy.policyVersion,
  });
}

module.exports = {
  getAiConfiguration,
  updateAiConfiguration,
  testAiConfiguration,
};
