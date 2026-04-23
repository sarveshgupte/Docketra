import { emitDiagnosticEvent, shouldEmitWarning } from './workflowDiagnostics';

const SLOW_REQUEST_THRESHOLD_MS = 900;
const inFlightRequests = new Map();

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

const log = (level, message, context) => emitDiagnosticEvent(level, message, context);

export const trackAsync = async (metricName, requestKey, runner) => {
  const key = String(requestKey || metricName || 'request');
  const startedAt = now();
  const activeCount = (inFlightRequests.get(key) || 0) + 1;
  inFlightRequests.set(key, activeCount);

  if (activeCount > 1) {
    if (shouldEmitWarning(`perf-dup:${key}`)) {
      log('warn', 'duplicate_inflight_request', { metricName, key, activeCount });
    }
  }

  try {
    return await runner();
  } finally {
    const durationMs = Math.round(now() - startedAt);
    const nextCount = Math.max(0, (inFlightRequests.get(key) || 1) - 1);
    if (nextCount === 0) inFlightRequests.delete(key);
    else inFlightRequests.set(key, nextCount);

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      log('warn', 'slow_request', { metricName, key, durationMs });
    } else {
      log('info', 'request_duration', { metricName, key, durationMs });
    }
  }
};

export const perfThresholds = {
  slowRequestMs: SLOW_REQUEST_THRESHOLD_MS,
};

export const markRouteTransition = (fromPath, toPath, durationMs) => {
  if (!fromPath || !toPath || fromPath === toPath) return;
  const roundedDuration = Math.round(durationMs);
  const level = roundedDuration >= 700 ? 'warn' : 'info';
  log(level, 'route_transition', {
    fromPath,
    toPath,
    durationMs: roundedDuration,
  });
};
