const ESCAPED_UNICODE_REGEX = /\\u[\dA-F]{4}/gi;
const ESCAPED_UNICODE_ASSERT_REGEX = /\\u[\dA-F]{4}/i;

export function decodeUnicode(str = '') {
  return String(str).replace(ESCAPED_UNICODE_REGEX, (match) =>
    String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
  );
}

export function warnIfEscapedUnicode(str = '', scope = 'copy') {
  if (!import.meta.env.DEV) return;
  if (ESCAPED_UNICODE_ASSERT_REGEX.test(String(str))) {
    // eslint-disable-next-line no-console
    console.warn(`[unicode] Escaped unicode sequence detected in ${scope}:`, String(str));
  }
}
