import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/docket/GuidedDocketForm.jsx'), 'utf8');

assert.ok(source.includes('employeeContextEnabled = selectedSubcategory?.employeeContextEnabled === true'), 'Employee dropdown must be driven by subcategory employeeContextEnabled flag.');
assert.ok(source.includes('if (employeeContextEnabled) return;') && source.includes("employeeXID: ''"), 'Employee xID should be cleared when employee context becomes disabled.');
assert.ok(source.includes("employeeXID: nextSubcategoryId ? prev.employeeXID : ''"), 'Employee xID should reset when category/subcategory changes invalidate the current subcategory.');
assert.ok(source.includes('label="Employee"'), 'Employee selector should be rendered in the form.');
assert.ok(source.includes('selectedEmployee ? `${selectedEmployee.xID} - ${selectedEmployee.name || selectedEmployee.email || \'User\'}`'), 'Review step should show employee label with xID and name/email.');

console.log('employeeContextGuidedDocketForm.test.mjs passed');
