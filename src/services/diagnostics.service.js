const mongoose = require('mongoose');
const { getState } = require('./systemState.service');
const { isFirmCreationDisabled, isGoogleAuthDisabled, areFileUploadsDisabled } = require('./featureFlags.service');
const { getRedisClient } = require('../config/redis');
const { _idempotencyCache } = require('../middleware/idempotency.middleware');
const metricsService = require('./metrics.service');
const { getTransactionMetrics } = require('./transactionMonitor.service');

const CACHE_TTL_MS = 30 * 1000;
let cached = null;
let cachedAt = 0;

const getRedisStatus = () => {
  const client = getRedisClient();
  if (!client) {
    return { available: false, status: 'unavailable' };
  }
  return {
    available: true,
    status: client.status,
    mode: client.options?.lazyConnect ? 'lazy' : 'eager',
  };
};

const measureDbLatency = async () => {
  try {
    if (!mongoose.connection?.db) return null;
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  } catch (err) {
    return null;
  }
};

const getDiagnosticsSnapshot = async () => {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const state = getState();
  const dbLatencyMs = await measureDbLatency();

  cached = {
    systemState: state.state,
    degradedReasons: (state.reasons || []).slice(-10),
    featureFlags: [
      { name: 'firmCreation', enabled: !isFirmCreationDisabled() },
      { name: 'googleAuth', enabled: !isGoogleAuthDisabled() },
      { name: 'fileUploads', enabled: !areFileUploadsDisabled() },
    ],
    redis: getRedisStatus(),
    dbLatencyMs,
    idempotencyCacheSize: _idempotencyCache?.size || 0,
    transactionFailures: getTransactionMetrics(),
    metrics: metricsService.getSnapshot(),
    generatedAt: new Date().toISOString(),
  };

  cachedAt = Date.now();
  return cached;
};

module.exports = {
  getDiagnosticsSnapshot,
};
