#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(protectedRoutes.includes('path="/app/superadmin/audit"'), 'Audit route must be registered');
assert.ok(protectedRoutes.includes('<ProtectedRoute requireSuperadmin>'), 'Audit route must be superadmin protected');

const lazyPages = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/lazyPages.jsx'), 'utf8');
assert.ok(lazyPages.includes('export const SuperadminAuditLogPage'), 'Lazy export for audit page should exist');

const layout = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
assert.ok(layout.includes('Audit Logs'), 'SuperAdmin nav should include Audit Logs link');
assert.ok(!layout.includes('href="#"'), 'Layout should not include placeholder links');

const page = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminAuditLogPage.jsx'), 'utf8');
assert.ok(page.includes('Timestamp'), 'Audit page should include Timestamp label');
assert.ok(page.includes('Action Type'), 'Audit page should include Action Type label');
assert.ok(page.includes('draftFilters'), 'Audit page should keep draftFilters state to avoid loading on every keystroke');
assert.ok(page.includes('setFilters(draftFilters)'), 'Apply filters should move draft filters into active query state');
assert.ok(page.includes('setDraftFilters(DEFAULT_FILTERS)'), 'Reset should clear draft filters');
assert.ok(page.includes('setFilters(DEFAULT_FILTERS)'), 'Reset should clear active filters');
assert.ok(page.includes('Audit logs show platform lifecycle/support actions only'), 'Audit page should include privacy boundary text');
assert.ok(!page.includes('href="#"'), 'Audit page should not include placeholder links');

console.log('superadminAuditLogViewer.ui.test.js passed');
