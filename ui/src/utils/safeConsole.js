const redact = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/bearer\s+\S+/i.test(value) || /(password|otp|token|cookie|authorization|reset|verify|api[_-]?key)/i.test(value)) {
      return '[REDACTED]';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = /(password|otp|token|cookie|authorization|reset|verify|api[_-]?key|signed|attachment)/i.test(key)
        ? '[REDACTED]'
        : redact(nested);
    }
    return output;
  }
  return value;
};

const safeCall = (method, ...args) => {
  if (import.meta.env.DEV) {
    const fn = console[method] || console.info;
    fn(...args.map((arg) => redact(arg)));
  }
};

export const safeConsole = {
  log: (...args) => safeCall('log', ...args),
  debug: (...args) => safeCall('debug', ...args),
  error: (...args) => safeCall('error', ...args),
  info: (...args) => safeCall('info', ...args),
  warn: (...args) => safeCall('warn', ...args),
};
