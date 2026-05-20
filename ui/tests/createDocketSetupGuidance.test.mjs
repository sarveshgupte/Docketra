import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const guidedForm = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(guidedForm.includes('Promise.allSettled(['), 'Create Docket should load dependencies independently via Promise.allSettled.');
assert.ok(!guidedForm.includes('Failed to load form options. Please refresh and retry.'), 'Generic form options failure message should not remain primary UX.');
assert.ok(guidedForm.includes('Add a client first.'), 'Setup guidance should include Add a client first.');
assert.ok(guidedForm.includes('Create a category and subcategory first.'), 'Setup guidance should include category/subcategory prerequisite.');
assert.ok(guidedForm.includes('Create an active workbasket first.'), 'Setup guidance should include workbasket prerequisite.');
assert.ok(guidedForm.includes('Retry failed loading'), 'Setup guidance should include retry action.');
assert.ok(guidedForm.includes('Hide checklist'), 'Setup checklist should be collapsible to reduce noise.');
assert.ok(!guidedForm.includes('style={{ display: \'flex\', gap: 8, marginBottom: 16, flexWrap: \'wrap\' }}'), 'Stepper wrapper should not use inline layout styles.');
assert.ok(!guidedForm.includes('style={{ display: \'flex\', gap: 8 }}'), 'Suggestion actions should not use inline layout styles.');
assert.ok(guidedForm.includes('guided-docket-stepper__item'), 'Stepper should rely on reusable class contracts.');
assert.ok(guidedForm.includes('Client encryption setup needs repair before clients can be loaded.'), 'TENANT_KEY_MISSING should be handled with clean setup repair copy.');
assert.ok(guidedForm.includes('label="Client (defaults to your firm for internal work)"'), 'Client selection should remain present in Create Docket form.');

const createDocketSurface = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(!createDocketSurface.includes('getCmsIntakeSettings'), 'Create Docket should not use CMS intake endpoints.');
assert.ok(!createDocketSurface.includes('crm.api'), 'Create Docket should not use CRM endpoints.');

console.log('createDocketSetupGuidance.test.mjs passed');
