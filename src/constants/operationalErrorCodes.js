const OPERATIONAL_ERROR_CODES = Object.freeze({
  STORAGE_NOT_AVAILABLE: 'STORAGE_NOT_AVAILABLE',
  STORAGE_NOT_CONNECTED: 'STORAGE_NOT_CONNECTED',
  UPLOAD_SESSION_EXPIRED: 'UPLOAD_SESSION_EXPIRED',
  UPLOAD_VERIFICATION_FAILED: 'UPLOAD_VERIFICATION_FAILED',
  UPLOAD_CHECKSUM_MISMATCH: 'UPLOAD_CHECKSUM_MISMATCH',
  UPLOAD_SESSION_BACKEND_UNAVAILABLE: 'UPLOAD_SESSION_BACKEND_UNAVAILABLE',
  UPLOAD_SESSION_NOT_FOUND: 'UPLOAD_SESSION_NOT_FOUND',
  TENANT_SCOPE_TAMPERING_DETECTED: 'TENANT_SCOPE_TAMPERING_DETECTED',
  CASE_ACCESS_DENIED: 'CASE_ACCESS_DENIED',
  CLIENT_ACCESS_RESTRICTED: 'CLIENT_ACCESS_RESTRICTED',
  CACHE_HYDRATION_FAILED: 'CACHE_HYDRATION_FAILED',
});

const normalizeOperationalError = (error = {}) => {
  const code = error?.code || error?.response?.data?.code || 'UNKNOWN_ERROR';
  return {
    code,
    status: Number.isInteger(error?.status) ? error.status : Number.isInteger(error?.statusCode) ? error.statusCode : null,
    message: typeof error?.message === 'string' ? error.message : null,
  };
};

module.exports = {
  OPERATIONAL_ERROR_CODES,
  normalizeOperationalError,
};
