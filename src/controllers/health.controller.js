const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const { validateEnv } = require('../config/validateEnv');

const liveness = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

const runReadinessChecks = async () => {
  const envResult = validateEnv({ exitOnError: false });
  if (!envResult.valid) {
    return { ok: false, reason: 'env', details: envResult.errors };
  }

  if (mongoose.connection.readyState !== 1) {
    return { ok: false, reason: 'db', details: 'MongoDB not connected' };
  }

  try {
    await mongoose.connection.db.admin().ping();
    await Promise.all([
      Firm.estimatedDocumentCount().catch(() => 0),
      User.estimatedDocumentCount().catch(() => 0),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'db', details: error.message };
  }
};

const readiness = async (req, res) => {
  const result = await runReadinessChecks();
  if (!result.ok) {
    return res.status(503).json({ status: 'not_ready', ...result, timestamp: new Date().toISOString() });
  }
  return res.json({ status: 'ready', timestamp: new Date().toISOString() });
};

module.exports = {
  liveness,
  readiness,
  runReadinessChecks,
};
