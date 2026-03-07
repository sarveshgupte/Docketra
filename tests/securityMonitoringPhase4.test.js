#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const express = require('express');
const request = require('supertest');

async function withTelemetryModules(run) {
  const originalLoad = Module._load;
  const auditEntries = [];
  const warnLogs = [];
  const infoLogs = [];

  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../utils/log') {
      return {
        info: (event, meta) => infoLogs.push({ event, meta }),
        warn: (event, meta) => warnLogs.push({ event, meta }),
        error: () => {},
      };
    }
    if (requestName === './audit.service') {
      return {
        logAuthEvent: async (entry) => {
          auditEntries.push(entry);
          return entry;
        },
      };
    }
    if (requestName === './forensicAudit.service') {
      return {
        getRequestIp: (req) => req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1',
        getRequestUserAgent: (req) => req.headers?.['user-agent'] || 'agent',
      };
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/services/securityAudit.service')];
  delete require.cache[require.resolve('../src/services/securityTelemetry.service')];

  try {
    const securityAudit = require('../src/services/securityAudit.service');
    const telemetry = require('../src/services/securityTelemetry.service');
    telemetry._resetForTests();
    await run({ securityAudit, telemetry, auditEntries, warnLogs, infoLogs });
  } finally {
    delete require.cache[require.resolve('../src/services/securityAudit.service')];
    delete require.cache[require.resolve('../src/services/securityTelemetry.service')];
    Module._load = originalLoad;
  }
}

async function testSuspiciousLoginDetectionAndRequestIdPropagation() {
  await withTelemetryModules(async ({ securityAudit, telemetry, auditEntries, warnLogs, infoLogs }) => {
    const req = {
      requestId: 'req-login-1',
      ip: '203.0.113.22',
      method: 'POST',
      originalUrl: '/api/auth/login?source=test',
      headers: {
        'user-agent': 'phase4-agent',
        'cf-ipcountry': 'CA',
      },
      user: {
        _id: '507f1f77bcf86cd799439011',
        xID: 'X000001',
        firmId: 'tenant-a',
      },
    };

    await securityAudit.logSecurityAuditEvent({
      req,
      action: securityAudit.SECURITY_AUDIT_ACTIONS.LOGIN_SUCCESS,
      resource: 'auth/login',
      metadata: { accessToken: 'secret-token' },
    });

    assert.strictEqual(infoLogs[0].meta.requestId, 'req-login-1', 'Security audit logs must include requestId');
    assert.strictEqual(auditEntries[0].req.requestId, 'req-login-1', 'Audit calls must carry requestId in request context');
    assert.strictEqual(auditEntries[0].metadata.requestId, 'req-login-1', 'Auth audit metadata must preserve requestId');
    assert.strictEqual(infoLogs[0].meta.metadata.accessToken, '[REDACTED]', 'Sensitive metadata must remain redacted');
    assert.strictEqual(auditEntries[0].metadata.route, '/api/auth/login', 'Auth audit metadata should derive route from request');
    assert.strictEqual(auditEntries[0].metadata.method, 'POST', 'Auth audit metadata should derive HTTP method from request');
    assert.strictEqual(auditEntries[0].metadata.userAgent, 'phase4-agent', 'Auth audit metadata should preserve request user agent');
    assert.strictEqual(auditEntries[0].metadata.ipRange, '203.0.113', 'Auth audit metadata should derive IP range from request');

    await telemetry.noteSuccessfulLogin({
      req,
      userId: '507f1f77bcf86cd799439011',
      firmId: 'tenant-a',
      xID: 'X000001',
      lastLoginIp: '198.51.100.9',
      lastLoginAt: new Date().toISOString(),
      lastLoginCountry: 'US',
    });

    for (let i = 0; i < 5; i += 1) {
      await telemetry.noteLoginFailure({
        req,
        xID: 'X000001',
        userId: '507f1f77bcf86cd799439011',
        firmId: 'tenant-a',
      });
    }

    assert(
      warnLogs.some((entry) => entry.meta.alertType === 'suspicious_login_pattern'),
      'Suspicious login monitoring must emit suspicious_login_pattern alerts'
    );
    assert(
      auditEntries.some((entry) => entry.actionType === 'SECURITY_ALERT' && entry.metadata.event === 'suspicious_login_pattern'),
      'Suspicious login monitoring must persist security alerts'
    );
  });
}

async function testAlertCooldownAndTelemetryPruning() {
  await withTelemetryModules(async ({ telemetry, auditEntries, warnLogs }) => {
    const originalNow = Date.now;
    let now = Date.parse('2026-03-07T06:00:00.000Z');
    Date.now = () => now;

    try {
      const req = {
        requestId: 'req-cooldown-1',
        ip: '203.0.113.55',
        method: 'GET',
        originalUrl: '/api/cases?page=1',
        headers: { 'user-agent': 'phase5-agent' },
      };

      await telemetry.emitSecurityAlert({
        req,
        userId: '507f1f77bcf86cd799439099',
        firmId: 'tenant-a',
        resource: '/api/cases',
        alertType: telemetry.ALERT_TYPES.API_ABUSE_DETECTED,
        metadata: { reason: 'rapid_api_access_from_single_ip' },
        description: 'Rapid API access detected from a single IP',
      });

      now += 5 * 60 * 1000;
      await telemetry.emitSecurityAlert({
        req,
        userId: '507f1f77bcf86cd799439099',
        firmId: 'tenant-a',
        resource: '/api/cases',
        alertType: telemetry.ALERT_TYPES.API_ABUSE_DETECTED,
        metadata: { reason: 'rapid_api_access_from_single_ip' },
        description: 'Rapid API access detected from a single IP',
      });

      assert.strictEqual(
        warnLogs.filter((entry) => entry.event === 'SECURITY_ALERT').length,
        1,
        'Duplicate alerts inside the cooldown window must be suppressed'
      );
      assert.strictEqual(
        auditEntries.filter((entry) => entry.actionType === 'SECURITY_ALERT').length,
        1,
        'Suppressed alerts must not create duplicate AuthAudit entries'
      );

      now += telemetry.ALERT_COOLDOWN;
      await telemetry.emitSecurityAlert({
        req,
        userId: '507f1f77bcf86cd799439099',
        firmId: 'tenant-a',
        resource: '/api/cases',
        alertType: telemetry.ALERT_TYPES.API_ABUSE_DETECTED,
        metadata: { reason: 'rapid_api_access_from_single_ip' },
        description: 'Rapid API access detected from a single IP',
      });

      assert.strictEqual(
        warnLogs.filter((entry) => entry.event === 'SECURITY_ALERT').length,
        2,
        'Alerts should emit again after the cooldown expires'
      );

      for (let i = 0; i < telemetry.MAX_TELEMETRY_KEYS + 250; i += 1) {
        await telemetry.noteRefreshTokenFailure({
          req: {
            ...req,
            ip: `198.51.${Math.floor(i / 255)}.${i % 255}`,
            requestId: `req-prune-counter-${i}`,
          },
          userId: `user-${i}`,
          firmId: 'tenant-a',
          reason: 'invalid_refresh_token',
        });
      }

      for (let i = 0; i < telemetry.MAX_WINDOW_EVENTS + 80; i += 1) {
        await telemetry.noteRefreshTokenUse({
          req: {
            ...req,
            ip: `192.0.2.${i % 250}`,
            requestId: `req-prune-window-${i}`,
          },
          userId: 'window-user',
          firmId: 'tenant-a',
          tokenIpAddress: `203.0.113.${i % 250}`,
        });
      }

      const state = telemetry._getInternalStateForTests();
      assert(state.countersSize <= telemetry.MAX_TELEMETRY_KEYS, 'Counter telemetry keys must be capped');
      assert(state.eventWindowsSize <= telemetry.MAX_TELEMETRY_KEYS, 'Window telemetry keys must be capped');
      assert(state.alertCooldownsSize <= telemetry.MAX_TELEMETRY_KEYS, 'Alert cooldown state must be capped');
      assert(state.maxWindowEntries <= telemetry.MAX_WINDOW_EVENTS, 'Per-window event buffers must be capped');
    } finally {
      Date.now = originalNow;
    }
  });
}

async function testRefreshTokenAbuseAlerts() {
  await withTelemetryModules(async ({ telemetry, auditEntries, warnLogs }) => {
    const invalidReq = {
      requestId: 'req-refresh-1',
      ip: '203.0.113.44',
      headers: { 'user-agent': 'phase4-agent' },
    };

    for (let i = 0; i < 3; i += 1) {
      await telemetry.noteRefreshTokenFailure({
        req: invalidReq,
        userId: '507f1f77bcf86cd799439012',
        firmId: 'tenant-b',
        reason: 'invalid_refresh_token',
      });
    }

    await telemetry.noteRefreshTokenUse({
      req: { ...invalidReq, requestId: 'req-refresh-2', ip: '198.51.100.81' },
      userId: '507f1f77bcf86cd799439012',
      firmId: 'tenant-b',
      tokenIpAddress: '203.0.113.44',
    });
    await telemetry.noteRefreshTokenUse({
      req: { ...invalidReq, requestId: 'req-refresh-3', ip: '192.0.2.31' },
      userId: '507f1f77bcf86cd799439012',
      firmId: 'tenant-b',
      tokenIpAddress: '203.0.113.44',
    });

    assert(
      warnLogs.some((entry) => entry.meta.alertType === 'refresh_token_abuse'),
      'Refresh abuse monitoring must emit refresh_token_abuse alerts'
    );
    assert(
      auditEntries.some((entry) => entry.metadata.reason === 'invalid_refresh_token'),
      'Repeated invalid refresh tokens must be captured in audit metadata'
    );
    assert(
      auditEntries.some((entry) => entry.metadata.reason === 'multiple_ips_rapidly'),
      'Rapid multi-IP refresh token use must be captured in audit metadata'
    );
  });
}

async function testMetricsEndpointRateLimiting() {
  const originalLoad = Module._load;
  const originalMetricsToken = process.env.METRICS_TOKEN;
  process.env.METRICS_TOKEN = 'internal-secret';

  Module._load = function (requestName, parent, isMain) {
    if (requestName === './auth.middleware') {
      return {
        authenticate: (req, res, next) => next(),
      };
    }
    if (requestName === './permission.middleware') {
      return {
        requireSuperadmin: (req, res, next) => next(),
      };
    }
    if (requestName === './securityAudit.middleware') {
      return {
        logSecurityEvent: async () => null,
      };
    }
    if (requestName === '../services/metrics.service') {
      return {
        recordRateLimitHit: () => null,
        recordApiRateLimitExceeded: () => null,
      };
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/middleware/rateLimiters')];
  delete require.cache[require.resolve('../src/middleware/internalMetricsAccess.middleware')];

  try {
    const { internalMetricsLimiter } = require('../src/middleware/rateLimiters');
    const { allowInternalTokenOrSuperadmin } = require('../src/middleware/internalMetricsAccess.middleware');
    const app = express();
    app.set('trust proxy', 1);
    app.get('/api/metrics/security', allowInternalTokenOrSuperadmin, internalMetricsLimiter, (req, res) => {
      res.json({ success: true });
    });

    for (let i = 0; i < 60; i += 1) {
      await request(app)
        .get('/api/metrics/security')
        .set('authorization', 'Bearer internal-secret')
        .set('x-forwarded-for', '198.51.100.10')
        .expect(200);
    }

    const limited = await request(app)
      .get('/api/metrics/security')
      .set('authorization', 'Bearer internal-secret')
      .set('x-forwarded-for', '198.51.100.10')
      .expect(429);

    assert.strictEqual(limited.body.error, 'RATE_LIMIT_EXCEEDED');
    assert(limited.headers['retry-after'], 'Metrics limiter must return retry-after information');

    if (typeof internalMetricsLimiter.resetKey === 'function') {
      internalMetricsLimiter.resetKey('198.51.100.10');
    }
  } finally {
    delete require.cache[require.resolve('../src/middleware/rateLimiters')];
    delete require.cache[require.resolve('../src/middleware/internalMetricsAccess.middleware')];
    Module._load = originalLoad;
    process.env.METRICS_TOKEN = originalMetricsToken;
  }
}

async function testSecurityAlertsAndSummaryEndpointsRequireSuperadmin() {
  const originalLoad = Module._load;
  const queryState = {
    skip: null,
    limit: null,
  };

  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../models/AuthAudit.model') {
      return {
        countDocuments: async () => 3,
        find: () => ({
          sort() { return this; },
          skip(value) { queryState.skip = value; return this; },
          limit(value) {
            queryState.limit = value;
            return {
              lean: async () => ([
                {
                  timestamp: new Date('2026-03-07T05:00:00.000Z'),
                  actionType: 'SECURITY_ALERT',
                  userId: '507f1f77bcf86cd799439011',
                  firmId: 'tenant-a',
                  ipAddress: '203.0.113.22',
                  description: 'Login detected from a new IP range',
                  requestId: 'req-alert-1',
                  metadata: { event: 'suspicious_login_pattern' },
                },
              ]),
            };
          },
        }),
        aggregate: async () => ([
          { alertType: 'suspicious_login_pattern', count: 2 },
          { alertType: 'refresh_token_abuse', count: 1 },
        ]),
      };
    }
    if (requestName === '../models/RefreshToken.model') {
      return {
        countDocuments: async () => 7,
      };
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/controllers/security.controller')];
  delete require.cache[require.resolve('../src/routes/security.routes')];

  try {
    const securityRoutes = require('../src/routes/security.routes');
    const app = express();
    app.use((req, res, next) => {
      req.user = { role: req.headers['x-role'] };
      next();
    });
    app.use('/api/security', securityRoutes);

    const denied = await request(app)
      .get('/api/security/alerts')
      .set('x-role', 'Admin')
      .expect(403);
    assert.match(denied.body.message, /superadmin/i);

    const summaryDenied = await request(app)
      .get('/api/security/summary')
      .set('x-role', 'Admin')
      .expect(403);
    assert.match(summaryDenied.body.message, /superadmin/i);

    const allowed = await request(app)
      .get('/api/security/alerts?page=2&limit=1')
      .set('x-role', 'SuperAdmin')
      .expect(200);

    assert.strictEqual(queryState.skip, 1, 'Pagination should calculate skip from page and limit');
    assert.strictEqual(queryState.limit, 1, 'Pagination should cap query by requested limit');
    assert.strictEqual(allowed.body.data[0].event, 'suspicious_login_pattern');
    assert.strictEqual(allowed.body.data[0].requestId, 'req-alert-1');

    const summary = await request(app)
      .get('/api/security/summary')
      .set('x-role', 'SuperAdmin')
      .expect(200);

    assert.strictEqual(summary.body.data.alerts_last_hour, 0, 'Summary should expose telemetry alert counts');
    assert.strictEqual(summary.body.data.login_failures_last_hour, 0, 'Summary should expose login failure counts');
    assert.strictEqual(summary.body.data.refresh_token_failures, 0, 'Summary should expose refresh token failure counts');
    assert.strictEqual(summary.body.data.active_sessions, 7, 'Summary should include active session count');
    assert.deepStrictEqual(summary.body.data.top_alert_types, [
      { alertType: 'suspicious_login_pattern', count: 2 },
      { alertType: 'refresh_token_abuse', count: 1 },
    ]);
  } finally {
    delete require.cache[require.resolve('../src/controllers/security.controller')];
    delete require.cache[require.resolve('../src/routes/security.routes')];
    Module._load = originalLoad;
  }
}

(async function run() {
  await testSuspiciousLoginDetectionAndRequestIdPropagation();
  await testAlertCooldownAndTelemetryPruning();
  await testRefreshTokenAbuseAlerts();
  await testMetricsEndpointRateLimiting();
  await testSecurityAlertsAndSummaryEndpointsRequireSuperadmin();
  console.log('securityMonitoringPhase4 tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
