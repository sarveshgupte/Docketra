const mongoose = require('mongoose');
const AuthAudit = require('../models/AuthAudit.model');

const buffer = [];

const recordAdminAudit = async ({
  actor,
  firmId,
  userId,
  action,
  target,
  scope,
  requestId,
  status,
  ipAddress,
  userAgent,
}) => {
  const entry = {
    actor,
    firmId,
    userId,
    action,
    target,
    scope,
    requestId,
    status,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
  };

  buffer.push(entry);

  if (mongoose.connection?.readyState === 1) {
    try {
      await AuthAudit.create({
        xID: actor || 'UNKNOWN',
        firmId: firmId || 'UNKNOWN',
        userId,
        actionType: 'AdminMutation',
        description: action,
        performedBy: actor || 'UNKNOWN',
        ipAddress,
        userAgent,
        metadata: {
          target,
          scope,
          requestId,
          status,
        },
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('[ADMIN_AUDIT] Failed to persist audit log:', err.message);
    }
  }

  return entry;
};

const getBufferedAudits = () => [...buffer];
const resetAuditBuffer = () => buffer.splice(0, buffer.length);

module.exports = {
  recordAdminAudit,
  getBufferedAudits,
  resetAuditBuffer,
};
