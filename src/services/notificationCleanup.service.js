const Notification = require('../models/Notification.model');
const log = require('../utils/log');

const DEFAULT_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 30;

function normalizeRetentionDays(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, Math.floor(parsed));
}

function getCutoffDate(retentionDays) {
  const now = Date.now();
  return new Date(now - (retentionDays * 24 * 60 * 60 * 1000));
}

async function cleanupReadNotifications(options = {}) {
  const retentionDays = normalizeRetentionDays(
    options.retentionDays ?? process.env.NOTIFICATION_RETENTION_DAYS
  );
  const cutoff = getCutoffDate(retentionDays);

  const query = {
    isRead: true,
    createdAt: { $lt: cutoff },
  };

  if (options.firmId) query.firmId = String(options.firmId);
  if (options.userId) query.userId = String(options.userId).toUpperCase();

  try {
    const result = await Notification.deleteMany(query);
    const deletedCount = Number(result?.deletedCount || 0);
    log.info('NOTIFICATION_CLEANUP_COMPLETED', {
      deletedCount,
      retentionDays,
      firmScoped: Boolean(options.firmId),
      userScoped: Boolean(options.userId),
    });
    return { deletedCount, retentionDays };
  } catch (error) {
    log.warn('NOTIFICATION_CLEANUP_FAILED', {
      message: error?.message,
      retentionDays,
      firmScoped: Boolean(options.firmId),
      userScoped: Boolean(options.userId),
    });
    return { deletedCount: 0, retentionDays, error: error?.message || 'cleanup_failed' };
  }
}

module.exports = {
  cleanupReadNotifications,
  normalizeRetentionDays,
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
};
