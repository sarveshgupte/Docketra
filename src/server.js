const log = require('./utils/log');
const { startServer } = require('./runtime/startServer');

startServer().catch((error) => {
  log.error('Failed to start server:', error);
  process.exit(1);
});
