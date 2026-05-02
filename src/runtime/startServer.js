const log = require('../utils/log');
const connectDB = require('../config/database');
const config = require('../config/config');
const { runBootstrap } = require('../services/bootstrap.service');
const { initNotificationSocket } = require('../services/notificationSocket.service');
const { sanitizeErrorForLog } = require('../utils/pii');
const { createApp } = require('../app/createApp');
const { getRedisClient, isRedisReady, isRedisUrlConfigured } = require('../config/redis');

const buildStartupErrorDetails = (error) => {
  const sanitizedError = sanitizeErrorForLog(error) || {};
  const normalizeStackLine = (line) => String(line || '')
    .replace(/%5BREDACTED%5D/gi, '[REDACTED]')
    .replace(/^null\s+/, '');
  const stackLines = String(sanitizedError.stack || error?.stack || '')
    .split('\n')
    .map((line) => normalizeStackLine(line.trim()))
    .filter(Boolean)
    .slice(0, 6);

  return {
    name: sanitizedError.name || error?.name || 'Error',
    message: sanitizedError.message || error?.message || 'Unknown startup error',
    code: sanitizedError.code || error?.code || null,
    stackFrames: stackLines,
  };
};

const startServer = async () => {
  log.info('STARTUP_TRACE_CREATE_APP_BEGIN');
  const app = createApp();
  log.info('STARTUP_TRACE_CREATE_APP_SUCCESS');

  log.info('STARTUP_TRACE_CONNECT_DB_BEGIN');
  await connectDB();
  log.info('STARTUP_TRACE_CONNECT_DB_SUCCESS');
  log.info('STARTUP_TRACE_RUN_BOOTSTRAP_BEGIN');
  await runBootstrap();
  log.info('STARTUP_TRACE_RUN_BOOTSTRAP_SUCCESS');

  const PORT = config.port;
  log.info('STARTUP_TRACE_APP_LISTEN_BEGIN', { port: PORT });
  const server = app.listen(PORT, () => {
    log.info(`[REDIS] REDIS_CONFIGURED=${isRedisUrlConfigured()}`);
    log.info(`[REDIS] REDIS_READY=${isRedisReady()}`);
    if (!isRedisReady()) {
      if (config.env === 'production') {
        log.warn('[REDIS] Startup continuing with degraded Redis status: security-sensitive endpoints will fail closed with HTTP 503 until Redis is ready.');
      } else {
        log.warn('[REDIS] Startup continuing with degraded Redis status: local/development mode will use in-memory fallbacks where supported.');
      }
    }

    log.info('API_RUNTIME_SCHEDULERS_DISABLED');
    log.info(`
╔════════════════════════════════════════════╗
║         Docketra API Server                ║
║                                            ║
║  Status: Running                           ║
║  Port: ${PORT}                              ║
║  Environment: ${config.env}                ║
║  URL: http://localhost:${PORT}             ║
║                                            ║
║  API Documentation: /api                   ║
║  Health Check: /health                     ║
╚════════════════════════════════════════════╝
  `);
  });

  try {
    log.info('STARTUP_TRACE_REDIS_INIT_BEGIN');
    getRedisClient();
    log.info('STARTUP_TRACE_REDIS_INIT_SUCCESS');
  } catch (redisInitError) {
    log.error('[REDIS] Startup Redis init skipped after bind due to error', sanitizeErrorForLog(redisInitError));
  }

  initNotificationSocket(server, { allowedOrigins: app.locals.allowedOrigins || [] });

  process.on('unhandledRejection', (err) => {
    const sanitizedError = sanitizeErrorForLog(err);
    log.error('Unhandled Promise Rejection:', sanitizedError);
    server.close(() => process.exit(1));
  });

  return { app, server };
};

module.exports = { startServer, buildStartupErrorDetails };
