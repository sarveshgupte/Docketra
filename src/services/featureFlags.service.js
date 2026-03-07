const {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isInboundEmailEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

module.exports = {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  isInboundEmailEnabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
};
