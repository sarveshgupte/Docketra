const {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

module.exports = {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
  ensureFirmCreationEnabled,
  ensureGoogleAuthEnabled,
  ensureFileUploadsEnabled,
};
