const TRANSIENT_MONGO_BINARY_ERROR_PATTERNS = [
  'MongoMemoryServer',
  'MongoMemoryReplSet',
  'MongoBinaryDownload',
  'Download failed for url',
  'Status Code is 403',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
];

function isMongoBinaryUnavailable(error) {
  if (!error) {
    return false;
  }

  const message = [error.message, error.cause?.message]
    .filter(Boolean)
    .join(' | ');

  return TRANSIENT_MONGO_BINARY_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

async function createMongoMemoryOrNull(factory, warningPrefix) {
  try {
    return await factory();
  } catch (error) {
    if (isMongoBinaryUnavailable(error)) {
      console.warn(`⚠️  ${warningPrefix}: ${error.message}`);
      return null;
    }

    throw error;
  }
}

module.exports = {
  createMongoMemoryOrNull,
  isMongoBinaryUnavailable,
};
