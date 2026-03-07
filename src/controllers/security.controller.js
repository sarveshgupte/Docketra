'use strict';

const AuthAudit = require('../models/AuthAudit.model');
const RefreshToken = require('../models/RefreshToken.model');
const log = require('../utils/log');
const { getSecurityMetricsSnapshot } = require('../services/securityTelemetry.service');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const listSecurityAlerts = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = Math.min(parsePositiveInteger(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;

    const filter = { actionType: 'SECURITY_ALERT' };
    const [total, alerts] = await Promise.all([
      AuthAudit.countDocuments(filter),
      AuthAudit.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: alerts.map((entry) => ({
        timestamp: entry.timestamp,
        event: entry.metadata?.event || entry.metadata?.reason || entry.actionType,
        userId: entry.userId || null,
        firmId: entry.firmId || null,
        ipAddress: entry.ipAddress || entry.metadata?.ipAddress || null,
        description: entry.description,
        requestId: entry.requestId || entry.metadata?.requestId || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    log.error('SECURITY_ALERT_LIST_FAILED', {
      req,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch security alerts',
    });
  }
};

const getSecurityMetrics = async (req, res) => {
  const snapshot = getSecurityMetricsSnapshot();
  let activeSessions = 0;
  let degraded = false;

  try {
    activeSessions = await RefreshToken.countDocuments({
      isRevoked: false,
      expiresAt: { $gt: new Date() },
      userId: { $ne: null },
    });
  } catch (error) {
    degraded = true;
    log.warn('SECURITY_METRICS_ACTIVE_SESSIONS_FAILED', {
      req,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    degraded,
    data: {
      ...snapshot,
      active_sessions: activeSessions,
    },
  });
};

module.exports = {
  listSecurityAlerts,
  getSecurityMetrics,
};
