class StorageError extends Error {
  constructor(message, statusCode = 500, code = 'STORAGE_ERROR', meta = {}) {
    super(message);
    this.name = 'StorageError';
    this.statusCode = statusCode;
    this.code = code;
    this.meta = meta;
  }
}

class StorageValidationError extends StorageError {
  constructor(message, meta = {}) {
    super(message, 400, 'STORAGE_VALIDATION_ERROR', meta);
    this.name = 'StorageValidationError';
  }
}

class StorageAuthError extends StorageError {
  constructor(message, statusCode = 401, meta = {}) {
    super(message, statusCode, 'STORAGE_AUTH_ERROR', meta);
    this.name = 'StorageAuthError';
  }
}

module.exports = {
  StorageError,
  StorageValidationError,
  StorageAuthError,
};
