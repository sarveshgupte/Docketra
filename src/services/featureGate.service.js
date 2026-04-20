const { markDegraded } = require('./systemState.service');
const log = require('../utils/log');

const normalize = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const flagged = new Set();

const flagStatus = (flagName, envVar) => {
  const disabled = normalize(envVar);
  if (disabled && !flagged.has(flagName)) {
    log.warn('FEATURE_BLOCKED', { feature: flagName, reason: 'flag_disabled' });
    markDegraded(`feature_${flagName}_disabled`, { flag: flagName });
    flagged.add(flagName);
  } else if (!disabled && flagged.has(flagName)) {
    flagged.delete(flagName);
  }
  return { disabled, enabled: !disabled };
};

const isFirmCreationDisabled = () => flagStatus('firmCreation', process.env.DISABLE_FIRM_CREATION).disabled;
const areFileUploadsDisabled = () => flagStatus('fileUploads', process.env.DISABLE_FILE_UPLOADS).disabled;
const isExternalStorageEnabled = () => normalize(process.env.ENABLE_EXTERNAL_STORAGE);

const ensureFeatureEnabled = (flagName, envVar) => {
  const { disabled } = flagStatus(flagName, envVar);
  if (disabled) {
    const err = new Error(`${flagName} is currently disabled`);
    err.statusCode = 503;
    err.code = 'FEATURE_DISABLED';
    throw err;
  }
};

const ensureFirmCreationEnabled = () => ensureFeatureEnabled('firmCreation', process.env.DISABLE_FIRM_CREATION);
const ensureFileUploadsEnabled = () => ensureFeatureEnabled('fileUploads', process.env.DISABLE_FILE_UPLOADS);

module.exports = {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
};
