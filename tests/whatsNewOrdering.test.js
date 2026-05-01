#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const filePath = path.join(__dirname, '..', 'docs', 'whats-new.md');
const source = fs.readFileSync(filePath, 'utf8');
const lines = source.split(/\r?\n/);

assert.strictEqual(lines[0], "# What's New", "docs/whats-new.md must start with '# What's New' on line 1");

const checklistHeading = '## May 2026: Checklist steps for KnowledgeItems';
const checklistMatches = [...source.matchAll(new RegExp(`^${checklistHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm'))];
assert.strictEqual(checklistMatches.length, 1, 'Checklist steps heading must appear exactly once');

const checklistIndex = lines.findIndex((line) => line.trim() === checklistHeading);
assert.ok(checklistIndex >= 0, 'Checklist steps heading must exist');

const firstAprilIndex = lines.findIndex((line) => /^## April 2026:/.test(line));
assert.ok(firstAprilIndex >= 0, 'docs/whats-new.md must contain at least one April 2026 heading');
assert.ok(checklistIndex < firstAprilIndex, 'Checklist steps heading must appear before first April 2026 heading');

console.log('✅ whatsNewOrdering.test.js passed');
