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
assert(form.includes('stepIndex === 3 && relatedEmployeeUserRequired'), 'Required related employee/user should be validated when field is visible in assignment step');
assert(!form.includes("if (stepIndex === 1) {\n      if (!payload.categoryId) nextErrors.categoryId = 'Select a category to continue.';\n      if (!payload.subcategoryId) nextErrors.subcategoryId = 'Select a subcategory to continue.';\n      if (relatedEmployeeUserRequired && !payload.relatedEmployeeUserId)"), 'Required related employee/user should not block classification step');

const payload = read('ui/src/components/docket/createDocketPayload.js');
assert(payload.includes('relatedEmployeeUserId: relatedEmployeeUserId || undefined'), 'Payload should include relatedEmployeeUserId only when selected');
assert(!payload.includes('assignedTo: relatedEmployeeUserId'), 'Assignee field must not be reused for related employee/user');

const detail = read('ui/src/pages/caseDetail/CaseDetailSummaryHeader.jsx');
assert(detail.includes('Related employee/user'), 'Docket detail should render related employee/user context');

const categoryModal = read('ui/src/pages/admin/components/AdminCategoryModals.jsx');
assert(categoryModal.includes('Require related employee/user during docket creation'), 'Category/subcategory settings UI should include requiresRelatedEmployeeUser toggle');
assert(categoryModal.includes('Enable this for HR, payroll, onboarding, offboarding, reimbursement, or employee-specific work.'), 'Settings UI should include helper guidance');

const categoryService = read('ui/src/services/categoryService.js');
assert(categoryService.includes('requiresRelatedEmployeeUser'), 'Category service should persist requiresRelatedEmployeeUser for create/add subcategory');

console.log('docket related employee/user UI static checks passed');
