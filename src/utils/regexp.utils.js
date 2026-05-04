/**
 * Regular Expression Utilities
 */

/**
 * Escapes special characters in a string for use in a Regular Expression.
 * Prevents ReDoS and other injection attacks by ensuring user input is treated as literal text.
 *
 * @param {string} value - The string to escape
 * @returns {string} The escaped string
 */
const escapeRegExp = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
  escapeRegExp,
};
