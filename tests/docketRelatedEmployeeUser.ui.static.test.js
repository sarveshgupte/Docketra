const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const form = read('ui/src/components/docket/GuidedDocketForm.jsx');
assert(form.includes('Related employee/user'), 'Create form should include Related employee/user field');
assert(form.includes('Not applicable'), 'Related employee/user should be optional with blank/default state');
assert(form.includes('relatedEmployeeUsers = users.filter((item) => (item?._id || item?.id)'), 'Form should filter out deleted/no-id users from options');
assert(form.includes('relatedEmployeeUserId'), 'Form state should include relatedEmployeeUserId');
assert(form.includes('This does not change who is assigned to work on the docket.'), 'Copy should clarify no assignment impact');
assert(form.includes('Employee (subcategory context)'), 'Legacy Employee field should be clearly distinguished');

const payload = read('ui/src/components/docket/createDocketPayload.js');
assert(payload.includes('relatedEmployeeUserId: relatedEmployeeUserId || undefined'), 'Payload should include relatedEmployeeUserId only when selected');
assert(!payload.includes('assignedTo: relatedEmployeeUserId'), 'Assignee field must not be reused for related employee/user');

const detail = read('ui/src/pages/caseDetail/CaseDetailSummaryHeader.jsx');
assert(detail.includes('Related employee/user'), 'Docket detail should render related employee/user context');

console.log('docket related employee/user UI static checks passed');
