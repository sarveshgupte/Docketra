#!/usr/bin/env node
require('dotenv').config();
'use strict';

const assert = require('assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');
const fs = require('fs');
const path = require('path');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

const loadRateLimiters = () => {
  Module._load = function patchedLoad(requestName, parent, isMain) {
    if (requestName === '../services/metrics.service') {
      return {
        recordRateLimitHit: () => {},
        recordApiRateLimitExceeded: () => {},
      };
    }
    if (requestName === './securityAudit.middleware') {
      return {
        logSecurityEvent: async () => {},
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/config/config');
  clearModule('../src/middleware/rateLimiters');
  const rateLimiters = require('../src/middleware/rateLimiters');
  Module._load = originalLoad;
  return rateLimiters;
};

async function testIpv4MappedIpv6RateLimitNormalization() {
  process.env.NODE_ENV = 'test';
  process.env.SECURITY_RATE_LIMIT_GLOBAL = '1';
  const { globalApiLimiter } = loadRateLimiters();
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', globalApiLimiter);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));

  await request(app).get('/api/ping').set('X-Forwarded-For', '::ffff:203.0.113.10').expect(200);
  await request(app).get('/api/ping').set('X-Forwarded-For', '203.0.113.10').expect(429);
  console.log('✓ rate limiter normalizes IPv4-mapped IPv6 client addresses');
}

async function testPrometheusMetricsRendering() {
  clearModule('../src/services/metrics.service');
  const metricsService = require('../src/services/metrics.service');
  metricsService.setQueueDepthProvider(async () => 7);
  metricsService.setDLQSizeProvider(async () => 2);
  metricsService.recordHttpRequest({
    method: 'GET',
    route: '/api/cases',
    status: 200,
    durationMs: 15,
  });
  metricsService.recordAuthFailure('/api/auth/profile');

  const rendered = await metricsService.renderPrometheusMetrics();
  assert(rendered.includes('docketra_http_requests_total{method="GET",route="/api/cases",status="200"} 1'));
  assert(rendered.includes('docketra_auth_failures_total{route="/api/auth/profile",status="401"} 1'));
  assert(rendered.includes('docketra_queue_depth{queue="storage"} 7'));
  console.log('✓ metrics service exports Prometheus-compatible counters and gauges');
}

async function testAdminStatusNormalization() {
  clearModule('../src/controllers/superadmin.controller');
  Module._load = function patchedLoad(requestName, parent, isMain) {
    if (requestName === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (requestName === 'bcrypt') {
      return {
        compare: async () => true,
        hash: async () => 'hash'
      };
    }
    return originalLoad.apply(this, arguments);
  };
  const controller = require('../src/controllers/superadmin.controller');
  Module._load = originalLoad;
  const Firm = require('../src/models/Firm.model');
  const User = require('../src/models/User.model');
  const SuperadminAudit = require('../src/models/SuperadminAudit.model');

  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalUserCountDocuments = User.countDocuments;
  const originalSuperadminAuditCreate = SuperadminAudit.create;

  const savedAdmin = {
    _id: '507f1f77bcf86cd799439012',
    xID: 'X000001',
    status: 'active',
    isActive: true,
    save: async function save() {
      return this;
    },
  };

  let lookupCount = 0;
  Firm.findById = () => ({
    select: async () => ({ _id: '507f1f77bcf86cd799439011', firmId: 'FIRM001', name: 'Acme' }),
  });
  User.findOne = async () => {
    lookupCount += 1;
    if (lookupCount === 1) {
      return {
        _id: '507f1f77bcf86cd799439012',
        xID: 'X000001',
        status: 'active',
        isActive: true,
      };
    }
    return savedAdmin;
  };
  User.countDocuments = async () => 2;
  SuperadminAudit.create = async () => ({});

  const req = {
    params: {
      firmId: '507f1f77bcf86cd799439011',
      adminId: '507f1f77bcf86cd799439012',
    },
    body: { status: 'DISABLED' },
    user: {
      email: 'superadmin@example.com',
      _id: '507f1f77bcf86cd799439099',
    },
    headers: {},
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  let nextError = null;
  await controller.updateFirmAdminStatus(req, res, (error) => {
    nextError = error;
  });

  assert.strictEqual(nextError, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(savedAdmin.status, 'disabled');
  assert.strictEqual(res.body.data.status, 'disabled');
  assert.strictEqual(res.body.message, 'Admin disabled successfully');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  User.countDocuments = originalUserCountDocuments;
  SuperadminAudit.create = originalSuperadminAuditCreate;
  console.log('✓ superadmin admin lifecycle normalizes DISABLED status consistently');
}

async function testDebugRoutesDisabledInProduction() {
  const serverSource = fs.readFileSync(path.join(__dirname, '../src/app/createApp.js'), 'utf8');
  const notFound = require('../src/middleware/notFound');
  const originalNodeEnv = process.env.NODE_ENV;

  assert.ok(/if\s*\(\s*!isProduction\s*\)/.test(serverSource) || /if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*['"]production['"]\s*\)/.test(serverSource), 'Debug routes must be conditionally mounted outside production');

  try {
    process.env.NODE_ENV = 'production';
    const app = express();
    app.use(notFound);

    await request(app).get('/api/debug/email-test').expect(404);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
  console.log('✓ debug routes are gated outside production and retain 404 fallback behavior');
}

async function run() {
  try {
    await testIpv4MappedIpv6RateLimitNormalization();
    await testPrometheusMetricsRendering();
    await testAdminStatusNormalization();
    await testDebugRoutesDisabledInProduction();
    delete process.env.SECURITY_RATE_LIMIT_GLOBAL;
    Module._load = originalLoad;
    console.log('Production hardening tests passed.');
  } catch (error) {
    Module._load = originalLoad;
    delete process.env.SECURITY_RATE_LIMIT_GLOBAL;
    console.error('Production hardening tests failed:', error);
    process.exit(1);
  }
}

run();
