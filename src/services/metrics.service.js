const metrics = {
  requests: {},
  errors: {},
  authFailures: 0,
  rateLimitHits: {},
  latencies: [],
  httpRequests: {},
  authFailuresByRoute: {},
  storageJobs: {
    started: 0,
    success: 0,
    failure: 0,
    retry: 0,
  },
  prometheusCounters: {
    api_rate_limit_exceeded_total: 0,
    tenant_throttle_exceeded_total: 0,
  },
};

const escapePrometheusLabel = (value) => String(value ?? 'unknown')
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/"/g, '\\"');

const buildMetricKey = (labels) => JSON.stringify(labels);

const incrementLabeledMetric = (bucket, labels, increment = 1) => {
  const key = buildMetricKey(labels);
  const current = bucket[key] || { labels, value: 0 };
  current.value += increment;
  bucket[key] = current;
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
  incrementLabeledMetric(metrics.authFailuresByRoute, { route: normalizeRoute(route), status: '401' });
};

const recordRateLimitHit = (limiterName) => {
  const key = limiterName || 'unknown';
  metrics.rateLimitHits[key] = (metrics.rateLimitHits[key] || 0) + 1;
};

const recordHttpRequest = ({ method, route, status, durationMs } = {}) => {
  const labels = {
    method: String(method || 'UNKNOWN').toUpperCase(),
    route: normalizeRoute(route),
    status: String(status || 'unknown'),
  };
  incrementLabeledMetric(metrics.httpRequests, labels);
  recordRequest(labels.route);
  if (Number(status) >= 400) {
    recordError(labels.status);
  }
  recordLatency(durationMs);
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
    httpRequests: Object.values(metrics.httpRequests),
    rateLimitHits: { ...metrics.rateLimitHits },
    latency: getLatencyPercentiles(),
    storageJobs: { ...metrics.storageJobs, dlqSize, queueDepth },
    prometheus: { ...metrics.prometheusCounters },
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

const renderPrometheusMetricLines = (name, bucket) => Object.values(bucket).map(({ labels, value }) => {
  const serializedLabels = Object.entries(labels)
    .map(([key, labelValue]) => `${key}="${escapePrometheusLabel(labelValue)}"`)
    .join(',');
  return `${name}{${serializedLabels}} ${value}`;
});

const renderPrometheusMetrics = async () => {
  const snapshot = await getSnapshot();
  const { getWorkerStatuses } = require('./workerRegistry.service');
  const workerStatuses = getWorkerStatuses();
  const lines = [
    '# HELP docketra_http_requests_total Total HTTP responses observed by method, route, and status.',
    '# TYPE docketra_http_requests_total counter',
    ...renderPrometheusMetricLines('docketra_http_requests_total', metrics.httpRequests),
    '# HELP docketra_http_request_duration_ms_count Number of latency samples observed.',
    '# TYPE docketra_http_request_duration_ms_count counter',
  ];

  Object.values(metrics.httpRequests).forEach(({ labels, value }) => {
    const serializedLabels = Object.entries(labels)
      .map(([key, labelValue]) => `${key}="${escapePrometheusLabel(labelValue)}"`)
      .join(',');
    lines.push(`docketra_http_request_duration_ms_count{${serializedLabels}} ${value}`);
  });

  lines.push(
    '# HELP docketra_http_request_duration_ms_summary Request latency percentiles in milliseconds.',
    '# TYPE docketra_http_request_duration_ms_summary gauge',
    `docketra_http_request_duration_ms_summary{quantile="0.50"} ${snapshot.latency.p50 ?? 0}`,
    `docketra_http_request_duration_ms_summary{quantile="0.95"} ${snapshot.latency.p95 ?? 0}`,
    '# HELP docketra_auth_failures_total Authentication failures by route.',
    '# TYPE docketra_auth_failures_total counter',
    ...renderPrometheusMetricLines('docketra_auth_failures_total', metrics.authFailuresByRoute),
    '# HELP docketra_queue_depth Current queue depth by queue name.',
    '# TYPE docketra_queue_depth gauge',
    `docketra_queue_depth{queue="storage"} ${snapshot.storageJobs.queueDepth}`,
    '# HELP docketra_worker_job_failures_total Permanent worker job failures.',
    '# TYPE docketra_worker_job_failures_total counter',
    `docketra_worker_job_failures_total{worker="storage"} ${snapshot.storageJobs.failure}`,
    '# HELP docketra_worker_status Worker runtime status (1=current status, 0=otherwise).',
    '# TYPE docketra_worker_status gauge',
  );

  Object.entries(workerStatuses).forEach(([worker, info]) => {
    ['disabled', 'starting', 'running', 'error'].forEach((status) => {
      lines.push(`docketra_worker_status{worker="${escapePrometheusLabel(worker)}",status="${status}"} ${info.status === status ? 1 : 0}`);
    });
  });

  lines.push(
    '# HELP docketra_rate_limit_hits_total Rate limiter trigger count by limiter.',
    '# TYPE docketra_rate_limit_hits_total counter',
  );
  Object.entries(metrics.rateLimitHits).forEach(([limiter, value]) => {
    lines.push(`docketra_rate_limit_hits_total{limiter="${escapePrometheusLabel(limiter)}"} ${value}`);
  });

  return `${lines.join('\n')}\n`;
};

module.exports = {
  recordRequest,
  recordError,
  recordAuthFailure,
  recordRateLimitHit,
  recordHttpRequest,
  getSnapshot,
  recordLatency,
  getLatencyPercentiles,
  renderPrometheusMetrics,
  setDLQSizeProvider,
  setQueueDepthProvider,
  recordStorageJobStarted: () => { metrics.storageJobs.started += 1; },
  recordStorageJobSuccess: () => { metrics.storageJobs.success += 1; },
  recordStorageJobFailure: () => { metrics.storageJobs.failure += 1; },
  recordStorageJobRetry: () => { metrics.storageJobs.retry += 1; },
  recordApiRateLimitExceeded: () => { metrics.prometheusCounters.api_rate_limit_exceeded_total += 1; },
  recordTenantThrottleExceeded: () => { metrics.prometheusCounters.tenant_throttle_exceeded_total += 1; },
};
