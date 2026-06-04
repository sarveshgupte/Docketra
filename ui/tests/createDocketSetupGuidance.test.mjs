import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const guidedForm = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(guidedForm.includes('Promise.allSettled(['), 'Create Docket should load dependencies independently via Promise.allSettled.');
assert.ok(!guidedForm.includes('Failed to load form options. Please refresh and retry.'), 'Generic form options failure message should not remain primary UX.');
assert.ok(guidedForm.includes('workbasketApi.listVisibleWorkbaskets()'), 'Create Docket should load user-visible workbaskets, not admin settings workbaskets.');
assert.ok(!guidedForm.includes('adminApi.listWorkbaskets'), 'Create Docket must not call admin-only workbasket APIs for regular users.');
assert.ok(guidedForm.includes('No client is available to your role yet.'), 'Setup guidance should use role-aware client copy.');
assert.ok(guidedForm.includes('No active category/subcategory is available yet.'), 'Setup guidance should include category/subcategory prerequisite.');
assert.ok(guidedForm.includes('No active category/subcategory is mapped to a workbasket yet.'), 'Setup guidance should include routing/workbasket prerequisite.');
assert.ok(guidedForm.includes('Ready from category routing.'), 'Workbasket setup should be considered ready when active subcategories already route to workbaskets.');
assert.ok(guidedForm.includes('isFirmAdminOrAbove(user)'), 'Admin setup links should be gated by firm role.');
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
