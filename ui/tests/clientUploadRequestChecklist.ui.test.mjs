import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('ui/src/pages/UploadPage.jsx'), 'utf8');

assert.ok(source.includes('requestChecklist'), 'Upload page should load request checklist metadata.');
assert.ok(source.includes('checklistItemId'), 'Upload page should pass checklistItemId during upload.');
assert.ok(source.includes('Requested item'), 'Upload page should render requested item selector.');
assert.ok(!source.includes('Reviewer note:'), 'Upload page must not render internal reviewer notes.');

console.log('client upload request checklist UI contract passed');
