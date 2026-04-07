const {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

module.exports = {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
};
