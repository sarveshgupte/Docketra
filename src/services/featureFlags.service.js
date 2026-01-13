const normalize = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const isFirmCreationDisabled = () => normalize(process.env.DISABLE_FIRM_CREATION);
const isGoogleAuthDisabled = () => normalize(process.env.DISABLE_GOOGLE_AUTH);
const areFileUploadsDisabled = () => normalize(process.env.DISABLE_FILE_UPLOADS);

module.exports = {
  isFirmCreationDisabled,
  isGoogleAuthDisabled,
  areFileUploadsDisabled,
};
