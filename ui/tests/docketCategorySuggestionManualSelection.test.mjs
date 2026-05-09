import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/docket/GuidedDocketForm.jsx'), 'utf8');
assert.ok(source.includes('manualClassification'));
assert.ok(source.includes('if (manualClassification) return;'));
assert.ok(source.includes('const applySuggestion = () =>'));
console.log('docketCategorySuggestionManualSelection.test.mjs passed');
