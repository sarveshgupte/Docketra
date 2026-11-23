import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(uiRoot, '..');

const resolvePath = (relFromUi) => {
  const fromUi = path.resolve(uiRoot, relFromUi);
  if (fs.existsSync(fromUi)) return fromUi;
  const fromRepo = path.resolve(repoRoot, 'ui', relFromUi);
  if (fs.existsSync(fromRepo)) return fromRepo;
  throw new Error(`Fixture not found: ${relFromUi}`);
};
const read = (relFromUi) => fs.readFileSync(resolvePath(relFromUi), 'utf8');

const storagePage = read('src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('Storage overview'), 'Storage settings should surface storage overview');
assert.ok(storagePage.includes('Generate storage export'), 'Storage settings should provide export generation entry point');

const timeline = read('src/components/common/AuditTimeline.jsx');
assert.ok(timeline.includes('getAuditActionLabel'), 'Audit timeline should use centralized audit action labels');

const timelineDrawer = read('src/components/common/AuditTimelineDrawer.jsx');
assert.ok(timelineDrawer.includes('getAuditActionLabel'), 'Audit timeline drawer should use centralized audit action labels');
assert.ok(timelineDrawer.includes('normalizeAuditAction'), 'Audit timeline drawer should normalize action names via shared helper');

console.log('storageTrustReadiness.test.mjs passed');
