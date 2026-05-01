import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const constantsSource = read('src/utils/constants.js');
const workTypeOptionsSource = read('src/utils/workTypeOptions.js');
const librarySource = read('src/pages/KnowledgeLibraryPage.jsx');
const linkedKnowledgeSource = read('src/pages/caseDetail/LinkedKnowledgeSection.jsx');
const companyBrainSource = read('src/pages/CompanyBrainPage.jsx');
const routesSource = read('src/constants/routes.js');

assert.ok(workTypeOptionsSource.includes('export const WORK_TYPE_OPTIONS'), 'workTypeOptions must export WORK_TYPE_OPTIONS');
assert.ok(workTypeOptionsSource.includes('export const normalizeWorkType'), 'workTypeOptions must export normalizeWorkType');
assert.ok(workTypeOptionsSource.includes('export const getWorkTypeLabel'), 'workTypeOptions must export getWorkTypeLabel');
assert.ok(workTypeOptionsSource.includes('export const isKnownWorkType'), 'workTypeOptions must export isKnownWorkType');
assert.ok(workTypeOptionsSource.includes('CASE_CATEGORIES'), 'workTypeOptions should use CASE_CATEGORIES as source');

assert.ok(librarySource.includes('WORK_TYPE_OPTIONS.map'), 'KnowledgeLibraryPage should render linked work type options from shared helper');
assert.ok(librarySource.includes('Other / custom (advanced)'), 'KnowledgeLibraryPage should provide custom/advanced linked work type escape hatch');
assert.ok(librarySource.includes('Custom:'), 'KnowledgeLibraryPage should preserve unknown custom linked work types while editing');
assert.ok(librarySource.includes('normalizeWorkType(form.linkedWorkType)'), 'KnowledgeLibraryPage should normalize linkedWorkType before save');
assert.ok(librarySource.includes("if (value === '')") && librarySource.includes("linkedWorkType: ''"), 'Selecting Unlinked should clear linkedWorkType instead of preserving stale values');
assert.ok(librarySource.includes('value !== CUSTOM_WORK_TYPE_OPTION'), 'Known work type selection should update linkedWorkType to canonical value');
assert.ok(librarySource.includes('Choose the same work type/category used by dockets so this knowledge appears during work execution.'), 'KnowledgeLibraryPage should include helper copy');

assert.ok(linkedKnowledgeSource.includes('normalizeWorkType'), 'LinkedKnowledgeSection should normalize category work type values');
assert.ok(linkedKnowledgeSource.includes('buildWorkTypeCandidates'), 'LinkedKnowledgeSection should include safe fallback for legacy category values');
assert.ok(linkedKnowledgeSource.includes('toArray(res?.data?.data || res?.data?.items || res?.data || [])'), 'LinkedKnowledgeSection should normalize API response shapes safely');

assert.ok(companyBrainSource.includes("!(item?.linkedWorkType || item?.linkedClientId || item?.linkedDocketId)"), 'Knowledge without links should continue to treat any linkedWorkType value as linked');

assert.ok(constantsSource.includes("CLIENT_NEW: 'Client - New'"), 'CASE_CATEGORIES should remain unchanged');
assert.ok(constantsSource.includes("OTHER: 'Other'"), 'CASE_CATEGORIES should remain unchanged');

for (const source of [librarySource, linkedKnowledgeSource, workTypeOptionsSource]) {
  assert.equal(/vector|embedding|openai|anthropic|document extraction/i.test(source), false, 'No AI/vector/embedding/document extraction infrastructure should be introduced');
}

for (const route of ['COMPANY_BRAIN', 'KNOWLEDGE_LIBRARY', 'CLIENT_WORKSPACE', 'CRM', 'CMS', 'TASK_MANAGER']) {
  assert.ok(routesSource.includes(route), `Route ${route} should remain unchanged`);
}

console.log('workTypeNormalization.test.mjs passed');
