const REDACTED = '[REDACTED]';
const REDACTED_URL = '[REDACTED_URL]';

const SECRET_KEY_PATTERN = /(password|passcode|otp|totp|token|secret|authorization|cookie|session|csrf|xsrf|api[_-]?key|reset|verification|verify|oauth|google|jwt|signed|signature)/i;
const IDENTITY_KEY_PATTERN = /(pan|aadhaar|aadhar)/i;
const PUBLIC_DIAGNOSTIC_SENSITIVE_PATTERN = /(comment|description|notes?|narrative|client(name|email|phone)?|case(name|title)?|attachment(url|name)?)/i;
const SENSITIVE_URL_PARAM_PATTERN = /(token|otp|password|reset|verification|verify|signature|sig|key|auth|code|state|expires|x-goog-signature|x-amz-signature|googleaccess|refreshtoken)/i;
const JWT_REGEX = /[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/;

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const sanitizeUrl = (value) => {
  if (typeof value !== 'string') return value;
  try {
    const parsed = new URL(value);
    let touched = false;
    for (const [key] of parsed.searchParams.entries()) {
      if (SENSITIVE_URL_PARAM_PATTERN.test(key)) {
        parsed.searchParams.set(key, REDACTED);
        touched = true;
      }
    }
    if (touched) return `${parsed.origin}${parsed.pathname}?${parsed.searchParams.toString()}`;
  } catch (_) {
    // ignore URL parsing errors and continue with regex heuristics
  }

  if (/https?:\/\//i.test(value) && SENSITIVE_URL_PARAM_PATTERN.test(value)) {
    return REDACTED_URL;
  }
  return value;
};

const sanitizeScalar = (key, value, mode) => {
  if (value === null || value === undefined) return value;
  const lowerKey = String(key || '').toLowerCase();

  if (SECRET_KEY_PATTERN.test(lowerKey) || IDENTITY_KEY_PATTERN.test(lowerKey)) return REDACTED;
  if (mode === 'public_diagnostics' && PUBLIC_DIAGNOSTIC_SENSITIVE_PATTERN.test(lowerKey)) return REDACTED;

  if (typeof value === 'string') {
    if (JWT_REGEX.test(value) || /^Bearer\s+/i.test(value.trim())) return REDACTED;
    if (/^\d{12}$/.test(value.replace(/\s|-/g, ''))) return REDACTED; // Aadhaar-like
    if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(value.trim())) return REDACTED; // PAN-like
    if (/https?:\/\//i.test(value) && SENSITIVE_URL_PARAM_PATTERN.test(value)) return sanitizeUrl(value);
  }

  return value;
};

const sanitizeRecursive = (value, mode, key = '', seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  const sanitizedScalar = sanitizeScalar(key, value, mode);
  if (sanitizedScalar !== value) return sanitizedScalar;

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((item) => sanitizeRecursive(item, mode, '', seen));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = sanitizeRecursive(childValue, mode, childKey, seen);
    }
    return output;
  }

  return value;
};

const sanitizeForLogs = (value) => sanitizeRecursive(value, 'log');
const sanitizeForAudit = (value) => sanitizeRecursive(value, 'audit');
const sanitizeForPublicDiagnostics = (value) => sanitizeRecursive(value, 'public_diagnostics');

const buildSafeFilterFlags = (filters = {}) => ({
  hasStatusFilter: Boolean(filters.status),
  hasCategoryFilter: Boolean(filters.category),
  hasPriorityFilter: Boolean(filters.priority),
  hasClientFilter: Boolean(filters.clientId),
  hasAssignmentFilter: Boolean(filters.assignedTo || filters.assignedToXID),
  hasSearchFilter: Boolean(filters.q || filters.searchQuery),
  hasWorkTypeFilter: Boolean(filters.workType),
  hasInternalFilter: typeof filters.isInternal !== 'undefined',
});

module.exports = {
  REDACTED,
  sanitizeForLogs,
  sanitizeForAudit,
  sanitizeForPublicDiagnostics,
  buildSafeFilterFlags,
};
