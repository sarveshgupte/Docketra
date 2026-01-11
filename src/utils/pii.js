/**
 * PII Masking Utility
 * Centralized helpers to mask sensitive values before logging.
 *
 * Covered fields:
 * - PAN (e.g., ABCDE1234F) -> AB***1234F
 * - Aadhaar (12 digits) -> **** **** 1234
 * - Email -> j***@d***.com
 * - Phone -> ********7890
 * - Tokens/Authorization headers -> prefix + last 2 characters preserved
 */

const PAN_REGEX = /([A-Z]{5})(\d{4})([A-Z])/i;
const AADHAAR_REGEX = /(\d{8})(\d{4})$/;
const JWT_REGEX = /[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/;

const maskEmail = (value) => {
  if (typeof value !== 'string' || !value.includes('@')) return value;
  const [local, domain] = value.split('@');
  const maskedLocal =
    local.length <= 2 ? `${local[0] || ''}*` : `${local[0]}${'*'.repeat(local.length - 2)}${local.slice(-1)}`;
  const [domainName, tld = ''] = domain.split('.');
  const maskedDomain =
    domainName.length <= 2 ? `${domainName[0] || ''}*` : `${domainName[0]}${'*'.repeat(domainName.length - 1)}`;
  return `${maskedLocal}@${maskedDomain}${tld ? `.${tld}` : ''}`;
};

const maskPhone = (value) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`;
};

const maskPAN = (value) => {
  if (typeof value !== 'string') return value;
  const match = value.match(PAN_REGEX);
  if (!match) return value;
  const [, start, middle, end] = match;
  return `${start.slice(0, 2)}***${middle}${end}`;
};

const maskAadhaar = (value) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\s|-/g, '');
  if (!/^\d{12}$/.test(cleaned)) return value;
  const match = cleaned.match(AADHAAR_REGEX);
  if (!match) return value;
  const [, prefix, suffix] = match;
  const maskedPrefix = `${'*'.repeat(4)} ${'*'.repeat(4)}`;
  return `${maskedPrefix} ${suffix}`;
};

const maskToken = (value) => {
  if (typeof value !== 'string') return value;
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
};

const maskValue = (key, value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return maskSensitiveObject(value);

  const lowerKey = (key || '').toLowerCase();

  if (['email', 'useremail'].includes(lowerKey)) return maskEmail(value);
  if (['phone', 'phonenumber', 'mobile'].includes(lowerKey)) return maskPhone(value);
  if (['pan', 'pan_number', 'pannumber'].includes(lowerKey)) return maskPAN(value);
  if (['aadhaar', 'aadhar', 'aadhaarnumber'].includes(lowerKey)) return maskAadhaar(value);
  if (['authorization', 'token', 'refreshtoken', 'accesstoken', 'idtoken'].includes(lowerKey)) return maskToken(value);

  // Heuristic masking for strings that look like tokens
  if (typeof value === 'string' && value.length > 20 && JWT_REGEX.test(value)) {
    // Likely JWT
    return maskToken(value);
  }

  return value;
};

const maskSensitiveObject = (input) => {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((item) => maskSensitiveObject(item));
  if (typeof input !== 'object') return input;

  return Object.entries(input).reduce((acc, [key, value]) => {
    acc[key] = maskValue(key, value);
    return acc;
  }, {});
};

module.exports = {
  maskEmail,
  maskPhone,
  maskPAN,
  maskAadhaar,
  maskToken,
  maskSensitiveObject,
  maskValue,
};
