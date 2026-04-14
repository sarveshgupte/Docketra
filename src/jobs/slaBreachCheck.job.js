'use strict';

const { syncSlaBreachNotifications } = require('../services/sla.service');

async function processSlaBreachCheckJob(payload = {}) {
  const dockets = Array.isArray(payload.dockets) ? payload.dockets : [];
  return syncSlaBreachNotifications(dockets, {
    firmId: payload.firmId,
    now: payload.now,
  });
}

module.exports = {
  processSlaBreachCheckJob,
};
