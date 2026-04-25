const log = require('../utils/log');
const connectDB = require('../config/database');
const config = require('../config/config');
const { runBootstrap } = require('../services/bootstrap.service');
const { initNotificationSocket } = require('../services/notificationSocket.service');
const { sanitizeErrorForLog } = require('../utils/pii');
const { createApp } = require('../app/createApp');

const startServer = async () => {
  const app = createApp();

  await connectDB();
  await runBootstrap();

  const PORT = config.port;
  const server = app.listen(PORT, () => {
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

  initNotificationSocket(server, { allowedOrigins: app.locals.allowedOrigins || [] });

  process.on('unhandledRejection', (err) => {
    const sanitizedError = sanitizeErrorForLog(err);
    log.error('Unhandled Promise Rejection:', sanitizedError);
    server.close(() => process.exit(1));
  });

  return { app, server };
};

module.exports = { startServer };
