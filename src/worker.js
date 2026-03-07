require('dotenv').config();

const connectDB = require('./config/database');
const log = require('./utils/log');
const { validateEnv } = require('./config/validateEnv');
const { logBuildMetadata } = require('./services/buildInfo.service');
const { startBackgroundWorkers, startBackgroundSchedules } = require('./services/workerBootstrap.service');

const bootstrapWorker = async () => {
  validateEnv();
  logBuildMetadata();
  await connectDB();
  startBackgroundWorkers();
  startBackgroundSchedules();
  log.info('WORKER_RUNTIME_READY');
};

bootstrapWorker().catch((error) => {
  console.error('Failed to start worker runtime:', error);
  process.exit(1);
});
