import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const settingsHub = read('src/pages/platform/SettingsPage.jsx');
assert.ok(settingsHub.includes('className="panel settings-menu"'), 'Settings hub should use one concise settings menu');
assert.equal((settingsHub.match(/title: '/g) || []).length, 6, 'Settings hub should expose 6 clear settings destinations');
assert.equal(settingsHub.includes('Storage & AI'), false, 'Settings hub should not bundle unrelated settings areas together');

const workSettings = read('src/pages/WorkSettingsPage.jsx');
assert.ok(workSettings.includes('Use Work Settings to control how new dockets enter team queues.'), 'Work settings should include queue-routing helper copy');
assert.ok(workSettings.includes('className="settings-form-split__meta"'), 'Work settings should use split meta column');
assert.ok(workSettings.includes('className="settings-form-split__controls space-y-2"'), 'Work settings should keep create/list controls grouped in one split controls column');

const aiPage = read('src/pages/AiSettingsPage.jsx');
assert.ok(aiPage.includes('AI is optional.'), 'AI settings should explicitly describe AI as optional');
assert.ok(aiPage.includes('className="settings-form-split"'), 'AI settings should use settings-form-split layout helper');
assert.ok(aiPage.includes('className="settings-action-bar"'), 'AI settings should use settings-action-bar helper for actions');
assert.ok(aiPage.includes('type="password"'), 'AI settings should keep API key entry masked');

const prHistory = read('../docs/features/pr-history/settings-admin-pages-polish.md');
assert.ok(!prHistory.includes('Firm Settings, Team & Access, Storage Settings'), 'PR history scope should not claim unmodified settings pages');
assert.ok(prHistory.includes('Work Settings and AI Settings UI polish.'), 'PR history should explicitly scope polish to changed pages');

const whatsNew = read('../docs/whats-new.md');
const polishedIndex = whatsNew.indexOf('## 2026-05-19 — Polished settings and admin pages');
const queueIndex = whatsNew.indexOf('## Polished queue workspaces');
assert.ok(polishedIndex >= 0, "What's New should include polished settings/admin entry");
assert.ok(polishedIndex < queueIndex, "What's New polished settings/admin entry should be in latest/top section");

console.log('settingsAdminPolish.test.mjs passed');
