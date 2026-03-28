class StorageConfigMissingError extends Error {
  constructor(tenantId) {
    super(`Active storage configuration not found for tenant ${tenantId}`);
    this.name = 'StorageConfigMissingError';
    this.code = 'STORAGE_CONFIG_MISSING';
    this.statusCode = 404;
    this.tenantId = tenantId;
  }
}

class StorageAccessError extends Error {
  constructor(message, tenantId, cause) {
    super(message);
    this.name = 'StorageAccessError';
    this.code = 'STORAGE_ACCESS_ERROR';
    this.statusCode = 502;
    this.tenantId = tenantId;
    this.cause = cause;
  }
}

class UnsupportedProviderError extends Error {
  constructor(provider, tenantId) {
    super(`Unsupported storage provider: ${provider}`);
    this.name = 'UnsupportedProviderError';
    this.code = 'UNSUPPORTED_STORAGE_PROVIDER';
    this.statusCode = 400;
    this.provider = provider;
    this.tenantId = tenantId;
  }
}

module.exports = {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
};
