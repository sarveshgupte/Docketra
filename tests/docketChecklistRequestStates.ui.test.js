const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve('ui/src/pages/caseDetail/CaseDetailOverviewPanel.jsx'), 'utf8');

assert.ok(source.includes("item?.status === 'accepted'"), 'Overview checklist should map accepted status badge.');
assert.ok(source.includes('Reviewer note:'), 'Overview checklist should expose reviewer notes in internal UI.');
assert.ok(source.includes('Due {formatDateTime(item.dueDate)}'), 'Overview checklist should show due date ageing context.');

console.log('docket checklist request states ui test passed');
