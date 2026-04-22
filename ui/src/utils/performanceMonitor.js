const SLOW_REQUEST_THRESHOLD_MS = 900;
const inFlightRequests = new Map();

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

const log = (level, message, context) => {
  if (typeof console === 'undefined') return;
  const method = console[level] || console.info;
  method(`[perf] ${message}`, context);
};

export const trackAsync = async (metricName, requestKey, runner) => {
  const key = String(requestKey || metricName || 'request');
  const startedAt = now();
  const activeCount = (inFlightRequests.get(key) || 0) + 1;
  inFlightRequests.set(key, activeCount);

  if (activeCount > 1) {
    log('warn', 'Duplicate in-flight request detected', { metricName, key, activeCount });
  }

  try {
    return await runner();
  } finally {
    const durationMs = Math.round(now() - startedAt);
    const nextCount = Math.max(0, (inFlightRequests.get(key) || 1) - 1);
    if (nextCount === 0) inFlightRequests.delete(key);
    else inFlightRequests.set(key, nextCount);

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      log('warn', 'Slow request', { metricName, key, durationMs });
    }
  }
};

export const perfThresholds = {
  slowRequestMs: SLOW_REQUEST_THRESHOLD_MS,
};
