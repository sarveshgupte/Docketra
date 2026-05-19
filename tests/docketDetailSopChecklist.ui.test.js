#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testOverviewPanelContainsSopChecklistSections() {
  const source = read('ui/src/pages/caseDetail/CaseDetailOverviewPanel.jsx');
  assert.ok(source.includes('SOP / Work Instructions'), 'Overview panel must include SOP section heading');
  assert.ok(source.includes('No SOP attached to this docket.'), 'Overview panel must include SOP empty state');
  assert.ok(source.includes('target="_blank"'), 'SOP links should open in new tab');
  assert.ok(source.includes('rel="noopener noreferrer"'), 'SOP links should include noopener noreferrer');
  assert.ok(source.includes('Checklist'), 'Overview panel must include Checklist heading');
  assert.ok(source.includes('No checklist attached to this docket.'), 'Overview panel must include checklist empty state');
  assert.ok(source.includes("sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))"), 'Checklist items must be sorted by sortOrder ascending');
  assert.ok(source.includes('Required'), 'Checklist section must include required label');
  console.log('  ✓ Overview panel includes read-only SOP + checklist rendering contract');
}

function testNormalizeCasePreservesSopChecklist() {
  const source = read('ui/src/pages/caseDetail/caseDetailUtils.js');
  assert.ok(source.includes('sop: detail.sop || legacy.sop || null'), 'normalizeCase legacy mapper must preserve sop payload');
  assert.ok(source.includes('checklist: Array.isArray(detail.checklist)'), 'normalizeCase legacy mapper must preserve checklist payload');
  console.log('  ✓ normalizeCase keeps sop/checklist from docket detail DTO');
}

(function run() {
  console.log('Running docket detail SOP/checklist UI tests...');
  testOverviewPanelContainsSopChecklistSections();
  testNormalizeCasePreservesSopChecklist();
  console.log('All docket detail SOP/checklist UI tests passed.');
})();
