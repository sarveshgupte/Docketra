import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wb = fs.readFileSync('ui/src/pages/WorkbasketPage.jsx','utf8');
const wl = fs.readFileSync('ui/src/pages/WorklistPage.jsx','utf8');

test('workbasket has multi/no membership states and pull CTA', () => {
  assert.ok(wb.includes('You are not linked to any workbasket yet. Ask your admin to assign you to a workbasket.'));
  assert.ok(wb.includes('Workbasket: {accessibleWorkbaskets[0].name}'));
  assert.ok(wb.includes('Pull to My Worklist'));
});

test('my worklist stays singular and personal', () => {
  assert.ok(wl.includes('My Worklist'));
  assert.ok(!wl.includes('Workbench'));
});
