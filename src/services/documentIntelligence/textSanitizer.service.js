'use strict';

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MAX_ANALYSIS_CHARS = Number(process.env.AI_ANALYSIS_MAX_PROMPT_CHARS || 12000);

function sanitizeTextForAI(rawText = '') {
  const withoutEmails = String(rawText || '').replace(EMAIL_REGEX, '[redacted-email]');
  const normalizedWhitespace = withoutEmails.replace(/\s+/g, ' ').trim();
  return normalizedWhitespace.slice(0, MAX_ANALYSIS_CHARS);
}

module.exports = {
  sanitizeTextForAI,
};
