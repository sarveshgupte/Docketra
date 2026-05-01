const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const { StorageConfigMissingError } = require('./storage/errors');

const getStorageAdapter = async (firm) => {
  const firmId = typeof firm === 'string' ? firm : firm?._id?.toString?.() || firm?.id || firm?.firmId;
  if (!firmId) {
    throw new StorageConfigMissingError('unknown');
  }
  return StorageProviderFactory.getProvider(firmId);
};

module.exports = {
  getStorageAdapter,
};
