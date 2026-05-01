function supportsListFiles(provider) {
  return Boolean(provider && typeof provider.listFiles === 'function');
}

function supportsSignedDownloadUrl(provider) {
  return Boolean(
    provider
    && (typeof provider.getSignedDownloadUrl === 'function'
      || typeof provider.getDownloadUrl === 'function'),
  );
}

function supportsHealthCheck(provider) {
  return Boolean(provider && typeof provider.testConnection === 'function');
}

module.exports = {
  supportsListFiles,
  supportsSignedDownloadUrl,
  supportsHealthCheck,
};
