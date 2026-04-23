import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const storagePage = read('src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('Current storage mode:'), 'Storage settings should surface current storage mode');
assert.ok(storagePage.includes('Firm-connected storage keeps document bytes in your firm-owned cloud environment.'), 'Storage settings should explain firm-connected mode in plain language');
assert.ok(storagePage.includes('Generate Firm Export'), 'Storage settings should provide export generation entry point');
assert.ok(storagePage.includes('Refresh Export History'), 'Storage settings should provide export history visibility');

const timeline = read('src/components/common/AuditTimeline.jsx');
assert.ok(timeline.includes('getAuditActionLabel'), 'Audit timeline should use centralized audit action labels');

const timelineDrawer = read('src/components/common/AuditTimelineDrawer.jsx');
assert.ok(timelineDrawer.includes('getAuditActionLabel'), 'Audit timeline drawer should use centralized audit action labels');
assert.ok(timelineDrawer.includes('normalizeAuditAction'), 'Audit timeline drawer should normalize action names via shared helper');

console.log('storageTrustReadiness.test.mjs passed');

