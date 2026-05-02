const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const SuperadminPlatformConfig = require('../models/SuperadminPlatformConfig.model');
const {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

const ROLLOUT_STAGES = ['off', 'internal', 'pilot', 'beta', 'general'];
const PLATFORM_FEATURE_FLAGS_KEY = 'feature_flags';

const FEATURE_FLAG_REGISTRY = [
  { key: 'crm_module', label: 'CRM Module', description: 'Controls CRM workflows in platform surfaces.', defaultStage: 'pilot', riskLevel: 'medium', allowFirmOverride: true },
  { key: 'cms_module', label: 'CMS Module', description: 'Controls CMS and intake orchestration metadata surfaces.', defaultStage: 'pilot', riskLevel: 'medium', allowFirmOverride: true },
  { key: 'task_manager', label: 'Task Manager', description: 'Controls task manager rollout metadata.', defaultStage: 'pilot', riskLevel: 'low', allowFirmOverride: true },
  { key: 'byos_google_drive', label: 'BYOS Google Drive', description: 'Controls BYOS Google Drive rollout metadata.', defaultStage: 'internal', riskLevel: 'high', allowFirmOverride: false },
  { key: 'byos_onedrive', label: 'BYOS OneDrive', description: 'Controls BYOS OneDrive rollout metadata.', defaultStage: 'internal', riskLevel: 'high', allowFirmOverride: false },
  { key: 'ai_features', label: 'AI Features', description: 'Controls AI feature rollout metadata.', defaultStage: 'internal', riskLevel: 'high', allowFirmOverride: true },
  { key: 'product_updates', label: 'Product Updates', description: 'Controls product update broadcast metadata.', defaultStage: 'pilot', riskLevel: 'low', allowFirmOverride: true },
  { key: 'pilot_readiness', label: 'Pilot Readiness', description: 'Controls pilot readiness control-surface metadata.', defaultStage: 'internal', riskLevel: 'medium', allowFirmOverride: false },
  { key: 'superadmin_global_search', label: 'Superadmin Global Search', description: 'Controls superadmin global search rollout metadata.', defaultStage: 'pilot', riskLevel: 'medium', allowFirmOverride: false },
];

const registryMap = new Map(FEATURE_FLAG_REGISTRY.map((f) => [f.key, f]));
const getFeatureFlagRegistry = () => FEATURE_FLAG_REGISTRY;
const getFeatureFlagConfigByKey = (key) => registryMap.get(String(key || '').trim());

const validateFirmIds = (firmIds = []) => {
  const ids = Array.isArray(firmIds) ? firmIds.map((id) => String(id || '').trim()) : [];
  const invalid = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  return { ids, invalid };
};

const updateFeatureFlagState = ({ key, enabledGlobally, rolloutStage }) => {
  const update = {};
  if (typeof enabledGlobally === 'boolean') update[`featureFlags.${key}.enabledGlobally`] = enabledGlobally;
  if (rolloutStage) update[`featureFlags.${key}.rolloutStage`] = rolloutStage;
  update[`featureFlags.${key}.updatedAt`] = new Date();
  return update;
};

const getFeatureFlagsSnapshot = async () => {
  const [platformConfig, firms] = await Promise.all([
    SuperadminPlatformConfig.findOne({ key: PLATFORM_FEATURE_FLAGS_KEY }).lean(),
    Firm.find({ status: { $ne: 'deleted' } }).select('featureFlags updatedAt').lean(),
  ]);

  const flags = FEATURE_FLAG_REGISTRY.map((flag) => {
    const platformState = platformConfig?.featureFlags?.[flag.key] || {};
    const enabledFirmCount = firms.reduce((acc, firm) => (firm?.featureFlags?.[flag.key]?.enabled ? acc + 1 : acc), 0);
    const updatedAt = platformState?.updatedAt || null;
    const enabledGlobally = platformState?.enabledGlobally === true;
    const rolloutStage = ROLLOUT_STAGES.includes(platformState?.rolloutStage) ? platformState.rolloutStage : flag.defaultStage;
    return {
      key: flag.key,
      label: flag.label,
      description: flag.description,
      status: enabledGlobally || enabledFirmCount > 0 ? 'enabled' : 'disabled',
      scope: flag.allowFirmOverride ? 'global+firm' : 'global',
      enabledGlobally,
      enabledFirmCount,
      rolloutStage,
      riskLevel: flag.riskLevel,
      updatedAt,
    };
  });

  return { flags };
};

module.exports = {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
  ROLLOUT_STAGES,
  getFeatureFlagRegistry,
  getFeatureFlagConfigByKey,
  getFeatureFlagsSnapshot,
  updateFeatureFlagState,
  validateFirmIds,
  PLATFORM_FEATURE_FLAGS_KEY,
  SuperadminPlatformConfig,
};
