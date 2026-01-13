const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const { validateEnv } = require('../config/validateEnv');
const { getRedisClient } = require('../config/redis');
const { getBuildMetadata } = require('../services/buildInfo.service');
const { STATES, resetState, markDegraded, getState, setState } = require('../services/systemState.service');
const { isFirmCreationDisabled, isGoogleAuthDisabled, areFileUploadsDisabled } = require('../services/featureGate.service');

const liveness = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

const runReadinessChecks = async () => {
  resetState();
  const build = getBuildMetadata();
  const checks = {
    env: 'ok',
    db: 'unknown',
    dbLatencyMs: null,
    redis: 'unknown',
    featureFlags: {},
    rateLimit: {
      enabled: !!process.env.REDIS_URL,
      redis: 'unknown',
    },
  };

  const envResult = validateEnv({ exitOnError: false });
  if (!envResult.valid) {
    checks.env = 'failed';
    markDegraded('env_invalid', { errors: envResult.errors });
  }

  if (mongoose.connection.readyState !== 1) {
    checks.db = 'disconnected';
    markDegraded('db_disconnected');
  } else {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - start;
      checks.dbLatencyMs = latency;
      if (latency > 750) {
        checks.db = 'degraded';
        markDegraded('db_slow', { latencyMs: latency });
      } else {
        checks.db = 'ok';
      }
      await Promise.all([
        Firm.estimatedDocumentCount().catch(() => 0),
        User.estimatedDocumentCount().catch(() => 0),
      ]);
    } catch (error) {
      checks.db = 'error';
      markDegraded('db_error', { message: error.message });
    }
  }

  const redisClient = getRedisClient();
  if (!redisClient) {
    checks.redis = 'not_configured';
    checks.rateLimit.redis = 'not_configured';
  } else {
    checks.redis = redisClient.status || 'unknown';
    checks.rateLimit.redis = redisClient.status || 'unknown';
    if (redisClient.status !== 'ready') {
      markDegraded('redis_unhealthy', { status: redisClient.status });
    }
  }

  const featureFlags = {
    firmCreation: isFirmCreationDisabled() ? 'disabled' : 'enabled',
    fileUploads: areFileUploadsDisabled() ? 'disabled' : 'enabled',
    googleAuth: isGoogleAuthDisabled() ? 'disabled' : 'enabled',
  };
  checks.featureFlags = featureFlags;
  if (Object.values(featureFlags).some((v) => v === 'disabled')) {
    markDegraded('feature_disabled', featureFlags);
  }

  const systemState = getState();
  const ready = systemState.state === STATES.NORMAL && checks.env === 'ok' && ['ok', 'degraded', 'not_configured', 'unknown'].includes(checks.redis) && ['ok', 'degraded'].includes(checks.db);
  if (ready) {
    setState(STATES.NORMAL);
  }
  return {
    ready,
    build,
    checks,
    systemState: getState(),
    uptimeSeconds: Math.round(process.uptime()),
  };
};

const readiness = async (req, res) => {
  const result = await runReadinessChecks();
  const isReady = result.ready && result.systemState.state === STATES.NORMAL;
  const status = isReady ? 'ready' : (result.systemState.state === STATES.DEGRADED ? 'degraded' : 'not_ready');
  const payload = {
    status,
    version: result.build.version,
    commit: result.build.commit,
    buildTimestamp: result.build.buildTimestamp,
    uptimeSeconds: result.uptimeSeconds,
    checks: result.checks,
    systemState: result.systemState,
    timestamp: new Date().toISOString(),
  };
  if (!isReady) {
    return res.status(503).json(payload);
  }
  return res.json(payload);
};

module.exports = {
  liveness,
  readiness,
  runReadinessChecks,
};
