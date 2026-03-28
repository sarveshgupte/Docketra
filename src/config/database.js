const mongoose = require('mongoose');
const log = require('../utils/log');
const config = require('./config');

/**
 * Database connection configuration
 * Handles MongoDB connection with proper error handling and retry logic
 */

const connectDB = async () => {
  try {
    // VALIDATION: Strict schema enforcement
    mongoose.set('strict', true);
    mongoose.set('strictQuery', true);
    if (process.env.MONGOOSE_DEBUG === 'true') {
      mongoose.set('debug', true);
    }

    const conn = await mongoose.connect(config.mongodbUri, {
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    log.info('MONGODB_CONNECTED', { host: conn.connection.host });

    mongoose.connection.on('connected', () => {
      log.info('MONGOOSE_CONNECTED');
    });

    mongoose.connection.on('error', (err) => {
      log.error('MONGOOSE_CONNECTION_ERROR', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      log.warn('MONGOOSE_DISCONNECTED');
    });
  } catch (error) {
    log.error('MONGODB_CONNECT_FAILED', { error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
