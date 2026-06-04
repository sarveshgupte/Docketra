import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = fs.existsSync(path.resolve(process.cwd(), 'ui', 'src'))
  ? path.resolve(process.cwd(), 'ui')
  : process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8');

const wb = read('src/pages/WorkbasketPage.jsx');
const wl = read('src/pages/WorklistPage.jsx');

test('workbasket has multi/no membership states and pull CTA', () => {
  assert.ok(wb.includes('You are not linked to any workbasket yet. Ask your admin to assign you to a workbasket.'));
  assert.ok(wb.includes('Workbasket Context:'), 'Workbasket page should show the active workbasket context when one is linked.');
  assert.ok(wb.includes('Pull to My Worklist'));
});

test('my worklist stays singular and personal', () => {
  assert.ok(wl.includes('My Worklist'));
  assert.ok(!wl.includes('Workbench'));
});
