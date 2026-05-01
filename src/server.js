require('dotenv').config();

const log = require('./utils/log');
const { startServer, buildStartupErrorDetails } = require('./runtime/startServer');

startServer().catch((error) => {
  log.error('FAILED_TO_START_SERVER', buildStartupErrorDetails(error));
  process.exit(1);
});
