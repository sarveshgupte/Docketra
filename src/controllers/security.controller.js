'use strict';

const AuthAudit = require('../models/AuthAudit.model');
const RefreshToken = require('../models/RefreshToken.model');
const { getSecurityMetricsSnapshot, SECURITY_METRIC_WINDOWS } = require('../services/securityTelemetry.service');
const log = require('../utils/log');
const { sanitizeForPublicDiagnostics } = require('../utils/redaction');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const countActiveSessions = async (req) => {
  try {
    return {
      degraded: false,
      count: await RefreshToken.countDocuments({
        isRevoked: false,
        expiresAt: { $gt: new Date() },
        userId: { $ne: null },
      }),
    };
  } catch (error) {
    log.warn('SECURITY_METRICS_ACTIVE_SESSIONS_FAILED', {
      req,
      error: error.message,
    });
    return {
      degraded: true,
      count: 0,
    };
  }
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
      data: alerts.map((entry) => sanitizeForPublicDiagnostics({
        timestamp: entry.timestamp,
        event: entry.metadata?.event || entry.metadata?.reason || entry.actionType,
        userId: entry.userId || null,
        firmId: entry.firmId || null,
        ipAddress: entry.ipAddress || entry.metadata?.ipAddress || null,
        severity: entry.metadata?.severity || 'low',
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
  const { degraded, count: activeSessions } = await countActiveSessions(req);

  return res.json({
    success: true,
    degraded,
    data: {
      ...snapshot,
      active_sessions: activeSessions,
    },
  });
};

const getSecuritySummary = async (req, res) => {
  const snapshot = getSecurityMetricsSnapshot();
  const { degraded: sessionDegraded, count: activeSessions } = await countActiveSessions(req);
  const summaryWindowStart = new Date(Date.now() - SECURITY_METRIC_WINDOWS.oneHour);
  let topAlertTypes = [];
  let degraded = sessionDegraded;

  try {
    topAlertTypes = await AuthAudit.aggregate([
      {
        $match: {
          actionType: 'SECURITY_ALERT',
          timestamp: { $gte: summaryWindowStart },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$metadata.event', '$actionType'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          alertType: '$_id',
          count: 1,
        },
      },
    ]);
  } catch (error) {
    degraded = true;
    log.warn('SECURITY_SUMMARY_ALERT_AGGREGATION_FAILED', {
      req,
      error: error.message,
    });
  }

  return res.json({
    success: true,
    degraded,
    data: {
      alerts_last_hour: snapshot.security_alerts_last_hour,
      login_failures_last_hour: snapshot.login_failures_last_hour,
      refresh_token_failures: snapshot.refresh_token_failures,
      critical_alerts_last_hour: snapshot.critical_alerts_last_hour,
      blocked_ips: snapshot.blocked_ips,
      tenant_abuse_events: snapshot.tenant_abuse_events,
      active_sessions: activeSessions,
      top_alert_types: topAlertTypes,
    },
  });
};

module.exports = {
  listSecurityAlerts,
  getSecurityMetrics,
  getSecuritySummary,
};
