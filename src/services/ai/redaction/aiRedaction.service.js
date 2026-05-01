const REDACTION_VERSION = '2026-05-01.redaction-v1';

const PATTERNS = [
  { type: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, placeholder: '[REDACTED_EMAIL]' },
  { type: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\d{10}|\d{3}[-.\s]\d{3}[-.\s]\d{4})\b/g, placeholder: '[REDACTED_PHONE]' },
  { type: 'pan', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, placeholder: '[REDACTED_PAN]' },
  { type: 'gstin', regex: /\b\d{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, placeholder: '[REDACTED_GSTIN]' },
  { type: 'aadhaar', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, placeholder: '[REDACTED_AADHAAR]' },
];

function redactSensitiveText(inputText, redactionProfile = 'byoai-default') {
  const source = String(inputText || '');
  const counts = {
    email: 0,
    phone: 0,
    pan: 0,
    gstin: 0,
    aadhaar: 0,
  };

  let redactedText = source;
  for (const pattern of PATTERNS) {
    redactedText = redactedText.replace(pattern.regex, () => {
      counts[pattern.type] += 1;
      return pattern.placeholder;
    });
  }

  return {
    redactedText,
    redactionProfile,
    redactionVersion: REDACTION_VERSION,
    counts,
  };
}

module.exports = {
  REDACTION_VERSION,
  redactSensitiveText,
};
