#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/controllers/superadmin.controller.js'), 'utf8');
assert.ok(source.includes('Math.min(requestedLimit, 100)'), 'Audit log endpoint should cap limit at 100');
assert.ok(source.includes('REDACT_PATTERN'), 'Audit log endpoint should define redact pattern');
assert.ok(source.includes("acc[key] = '[REDACTED]'"), 'Sensitive metadata keys should be redacted');
console.log('superadminAuditLogController.guardrails.test.js passed');
