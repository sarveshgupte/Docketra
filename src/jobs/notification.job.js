'use strict';

const { createNotification } = require('../services/notification.service');

async function processNotificationJob(payload = {}) {
  return createNotification(payload);
}

module.exports = {
  processNotificationJob,
};
