const log = require('../utils/log');
const connectDB = require('../config/database');
const config = require('../config/config');
const { runBootstrap } = require('../services/bootstrap.service');
const { initNotificationSocket } = require('../services/notificationSocket.service');
const { sanitizeErrorForLog } = require('../utils/pii');
const { createApp } = require('../app/createApp');
const { getRedisClient, isRedisReady, isRedisUrlConfigured } = require('../config/redis');

const startServer = async () => {
  const app = createApp();

  await connectDB();
  await runBootstrap();

  const PORT = config.port;
  const server = app.listen(PORT, () => {
    log.info(`[REDIS] REDIS_CONFIGURED=${isRedisUrlConfigured()}`);
    log.info(`[REDIS] REDIS_READY=${isRedisReady()}`);
    if (!isRedisReady()) {
      log.warn('[REDIS] Startup continuing with degraded Redis status');
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
    getRedisClient();
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

module.exports = { startServer };
