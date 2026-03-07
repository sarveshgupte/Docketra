const {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isInboundEmailEnabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

module.exports = {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isInboundEmailEnabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
};
