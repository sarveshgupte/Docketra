const {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
} = require('./featureGate.service');

module.exports = {
  isFirmCreationDisabled,
  areFileUploadsDisabled,
  isExternalStorageEnabled,
  ensureFirmCreationEnabled,
  ensureFileUploadsEnabled,
};
