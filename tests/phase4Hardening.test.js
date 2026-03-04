#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

async function testExportCapEnforcement() {
  const Case = require('../src/models/Case.model');
  const { getPendingCasesReport } = require('../src/controllers/reports.controller');

  const originalFind = Case.find;
  Case.find = () => ({
    limit: () => ({
      lean: async () => Array.from({ length: 5001 }, (_, i) => ({ caseId: `CASE-20260101-${String(i).padStart(5, '0')}` })),
    }),
  });

  const req = { query: {}, firmId: 'firm-a' };
  const out = {};
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { out.payload = payload; return this; },
  };

  try {
    await getPendingCasesReport(req, res);
  } finally {
    Case.find = originalFind;
  }

  assert.strictEqual(res.statusCode, 400, 'Export row cap should return 400');
  assert.match(out.payload.message, /exceeds 5000 rows/i);
}

function testMetricsEndpointRequiresTokenInProduction() {
  const serverPath = path.join(__dirname, '..', 'src', 'server.js');
  const result = spawnSync(process.execPath, ['-e', `process.env.NODE_ENV='production';require(${JSON.stringify(serverPath)});`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: 'x',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/does-not-matter',
      REDIS_URL: 'redis://127.0.0.1:6379',
      SUPERADMIN_PASSWORD_HASH: '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC',
      METRICS_TOKEN: '',
      BREVO_API_KEY: 'stub',
      MAIL_FROM: 'Test <test@example.com>',
    },
  });

  assert.notStrictEqual(result.status, 0, 'Server startup should fail closed without METRICS_TOKEN');
  assert.match(`${result.stderr}${result.stdout}`, /METRICS_TOKEN is required in production/);
}

(async function run() {
  await testExportCapEnforcement();
  testMetricsEndpointRequiresTokenInProduction();
  console.log('phase4Hardening tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
