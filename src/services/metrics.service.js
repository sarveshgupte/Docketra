const metrics = {
  requests: {},
  errors: {},
  authFailures: 0,
  rateLimitHits: {},
  latencies: [],
  storageJobs: {
    started: 0,
    success: 0,
    failure: 0,
    retry: 0,
  },
};

// Dynamic providers injected at startup so the snapshot reflects live queue state
// without making the storage modules a hard dependency of this service.
let dlqSizeProvider = async () => 0;
let queueDepthProvider = async () => 0;

/**
 * Inject a provider for the real-time DLQ size.
 * Called once at worker startup.
 * @param {() => Promise<number>} fn
 */
const setDLQSizeProvider = (fn) => { dlqSizeProvider = fn; };

/**
 * Inject a provider for the real-time storage queue depth.
 * Called once at worker startup.
 * @param {() => Promise<number>} fn
 */
const setQueueDepthProvider = (fn) => { queueDepthProvider = fn; };

const normalizeRoute = (route) => {
  if (!route) return 'unknown';
  return route.split('?')[0];
};

const recordRequest = (route) => {
  const key = normalizeRoute(route);
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
};

const recordError = (statusCode) => {
  const code = String(statusCode || 'unknown');
  metrics.errors[code] = (metrics.errors[code] || 0) + 1;
};

const recordAuthFailure = (route) => {
  metrics.authFailures += 1;
  recordError(401);
  recordRequest(normalizeRoute(route));
};

const recordRateLimitHit = (limiterName) => {
  const key = limiterName || 'unknown';
  metrics.rateLimitHits[key] = (metrics.rateLimitHits[key] || 0) + 1;
};

const getSnapshot = async () => {
  const [dlqSize, queueDepth] = await Promise.all([
    dlqSizeProvider().catch(() => 0),
    queueDepthProvider().catch(() => 0),
  ]);
  return {
    requests: { ...metrics.requests },
    errors: { ...metrics.errors },
    authFailures: metrics.authFailures,
    rateLimitHits: { ...metrics.rateLimitHits },
    latency: getLatencyPercentiles(),
    storageJobs: { ...metrics.storageJobs, dlqSize, queueDepth },
  };
};

const recordLatency = (durationMs) => {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return;
  metrics.latencies.push(durationMs);
  if (metrics.latencies.length > 500) {
    metrics.latencies.shift();
  }
};

const percentile = (arr, p) => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
};

const getLatencyPercentiles = () => ({
  p50: percentile(metrics.latencies, 50),
  p95: percentile(metrics.latencies, 95),
  samples: metrics.latencies.length,
});

module.exports = {
  recordRequest,
  recordError,
  recordAuthFailure,
  recordRateLimitHit,
  getSnapshot,
  recordLatency,
  getLatencyPercentiles,
  setDLQSizeProvider,
  setQueueDepthProvider,
  recordStorageJobStarted: () => { metrics.storageJobs.started += 1; },
  recordStorageJobSuccess: () => { metrics.storageJobs.success += 1; },
  recordStorageJobFailure: () => { metrics.storageJobs.failure += 1; },
  recordStorageJobRetry: () => { metrics.storageJobs.retry += 1; },
};
