const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

const ROLLOUT_STAGES = ['off', 'internal', 'pilot', 'beta', 'general'];

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

const getFirmFlagState = (firm, key, defaults) => {
  const stored = firm?.featureFlags?.[key] || {};
  const enabledFirms = Array.isArray(stored.enabledFirmIds) ? stored.enabledFirmIds : [];
  return {
    enabledGlobally: stored.enabledGlobally === true,
    rolloutStage: ROLLOUT_STAGES.includes(stored.rolloutStage) ? stored.rolloutStage : defaults.defaultStage,
    enabledFirmCount: enabledFirms.length,
    updatedAt: stored.updatedAt || firm?.updatedAt || null,
  };
};

const getFeatureFlagsSnapshot = async () => {
  const firms = await Firm.find({ status: { $ne: 'deleted' } }).select('featureFlags updatedAt').lean();

  const flags = FEATURE_FLAG_REGISTRY.map((flag) => {
    let enabledGlobally = false;
    let enabledFirmCount = 0;
    let updatedAt = null;
    let rolloutStage = flag.defaultStage;

    for (const firm of firms) {
      const state = getFirmFlagState(firm, flag.key, flag);
      if (state.enabledGlobally) enabledGlobally = true;
      enabledFirmCount += state.enabledFirmCount;
      if (state.rolloutStage && state.rolloutStage !== flag.defaultStage) rolloutStage = state.rolloutStage;
      if (state.updatedAt && (!updatedAt || new Date(state.updatedAt) > new Date(updatedAt))) {
        updatedAt = state.updatedAt;
      }
    }

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

const updateFeatureFlagState = async ({ key, enabledGlobally, rolloutStage, firmIds }) => {
  const update = {};
  if (typeof enabledGlobally === 'boolean') update[`featureFlags.${key}.enabledGlobally`] = enabledGlobally;
  if (rolloutStage) update[`featureFlags.${key}.rolloutStage`] = rolloutStage;
  if (Array.isArray(firmIds)) {
    update[`featureFlags.${key}.enabledFirmIds`] = firmIds
      .map((id) => String(id || '').trim())
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
  }
  update[`featureFlags.${key}.updatedAt`] = new Date();
  return update;
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
};
