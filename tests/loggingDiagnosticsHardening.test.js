const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { sanitizeForLogs, sanitizeForAudit, sanitizeForPublicDiagnostics } = require('../src/utils/redaction');
const { logSlowEndpoint } = require('../src/utils/slowLog');
const log = require('../src/utils/log');

const repoRoot = path.resolve(__dirname, '..');

const run = () => {
  const securityDoc = fs.readFileSync(path.join(repoRoot, 'docs/security/SECURITY.md'), 'utf8');
  assert.ok(securityDoc.includes('## Current Security Status'), 'SECURITY.md must retain current security status section');
  assert.ok(securityDoc.includes('### ⚠️ Known Security Limitations'), 'SECURITY.md must retain security limitations section');
  assert.ok(securityDoc.includes('## April 2026 logging/redaction and diagnostics addendum'), 'SECURITY.md must include April 2026 addendum');

  const safeConsoleSource = fs.readFileSync(path.join(repoRoot, 'ui/src/utils/safeConsole.js'), 'utf8');
  assert.ok(!safeConsoleSource.includes('console[method] ='), 'safeConsole must not monkey patch global console methods');
  assert.ok(!safeConsoleSource.includes('installProductionConsoleGuards'), 'installProductionConsoleGuards should be removed');

  const sample = {
    description: 'Docket status changed',
    comment: 'Followed up with client',
    clientName: 'Acme Corp',
    resetLink: 'https://app.example/reset?token=abc',
    accessToken: 'abc.def.ghi',
  };

  const logSanitized = sanitizeForLogs(sample);
  assert.strictEqual(logSanitized.description, 'Docket status changed');
  assert.strictEqual(logSanitized.comment, 'Followed up with client');
  assert.strictEqual(logSanitized.accessToken, '[REDACTED]');

  const auditSanitized = sanitizeForAudit(sample);
  assert.strictEqual(auditSanitized.description, 'Docket status changed');
  assert.strictEqual(auditSanitized.comment, 'Followed up with client');
  assert.strictEqual(auditSanitized.resetLink.includes('[REDACTED]'), true);

  const publicSanitized = sanitizeForPublicDiagnostics(sample);
  assert.strictEqual(publicSanitized.description, '[REDACTED]');
  assert.strictEqual(publicSanitized.comment, '[REDACTED]');
  assert.strictEqual(publicSanitized.clientName, '[REDACTED]');

  const captured = [];
  const originalWarn = log.warn;
  log.warn = (...args) => captured.push(args);
  logSlowEndpoint({
    marker: '[REPORT_QUERY_SLOW]',
    thresholdMs: 100,
    durationMs: 180,
    req: { method: 'GET', originalUrl: '/api/reports?search=client&token=secret', requestId: 'req-1' },
  });
  log.warn = originalWarn;
  assert.ok(captured.length > 0, 'slow log should emit when threshold exceeded');
  assert.strictEqual(captured[0][1].route, '/api/reports', 'slow log route should exclude query string');

  const productionOutput = execSync('NODE_ENV=production node -e "const log=require(\'./src/utils/log\'); log.error(\'PROD_ERR\',{error:new Error(\'boom\')});"', { cwd: repoRoot }).toString();
  assert.ok(!productionOutput.includes('"stack"'), 'production logs should omit stack by default');

  const stackEnabledOutput = execSync('NODE_ENV=production LOG_INCLUDE_STACK=true node -e "const log=require(\'./src/utils/log\'); log.error(\'PROD_ERR\',{error:new Error(\'boom\')});"', { cwd: repoRoot }).toString();
  assert.ok(stackEnabledOutput.includes('"stack"'), 'stack should be included when LOG_INCLUDE_STACK=true');

  const reportsSource = fs.readFileSync(path.join(repoRoot, 'src/controllers/reports.controller.js'), 'utf8');
  const docketSource = fs.readFileSync(path.join(repoRoot, 'src/services/caseQuery.service.js'), 'utf8');
  const reportLeakLines = reportsSource.split('\n').filter((line) => line.includes('error: error.message') && !line.includes('includeInternalErrorDetails'));
  const docketLeakLines = docketSource.split('\n').filter((line) => line.includes('error: error.message') && !line.includes('includeInternalErrorDetails'));
  assert.strictEqual(reportLeakLines.length, 0, `reports controller has unguarded raw error.message lines: ${reportLeakLines.join(' | ')}`);
  assert.strictEqual(docketLeakLines.length, 0, `docket query service has unguarded raw error.message lines: ${docketLeakLines.join(' | ')}`);

  console.log('loggingDiagnosticsHardening.test.js passed');
};

try {
  run();
} catch (error) {
  console.error('loggingDiagnosticsHardening.test.js failed', error);
  process.exit(1);
}
