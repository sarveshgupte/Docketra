require('dotenv').config();

const log = require('./utils/log');
const { startServer } = require('./runtime/startServer');
const { sanitizeErrorForLog } = require('./utils/pii');

startServer().catch((error) => {
  const sanitized = sanitizeErrorForLog(error) || {};
  log.error('FAILED_TO_START_SERVER', {
    name: sanitized.name || error?.name || 'Error',
    message: sanitized.message || error?.message || 'Unknown startup error',
    code: sanitized.code || error?.code || null,
  });
  process.exit(1);
});
