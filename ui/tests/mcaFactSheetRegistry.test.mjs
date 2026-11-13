import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const factSheetModal = fs.readFileSync(path.join(root, 'ui', 'src', 'components', 'common', 'ClientFactSheetModal.jsx'), 'utf8');
const workspacePage = fs.readFileSync(path.join(root, 'ui', 'src', 'pages', 'ClientWorkspacePage.jsx'), 'utf8');
const clientApi = fs.readFileSync(path.join(root, 'ui', 'src', 'api', 'client.api.js'), 'utf8');
const caseController = fs.readFileSync(path.join(root, 'src', 'controllers', 'case.controller.js'), 'utf8');
const clientRoutesSchema = fs.readFileSync(path.join(root, 'src', 'schemas', 'client.routes.schema.js'), 'utf8');

// 1. Verify ClientFactSheetModal has Directors Registry and Past Filings
assert(factSheetModal.includes('Directors Registry'), 'ClientFactSheetModal must include Directors Registry tab');
assert(factSheetModal.includes('Past Filings'), 'ClientFactSheetModal must include Past Filings tab');
assert(factSheetModal.includes('Compliance Deadlines'), 'ClientFactSheetModal must include Compliance Deadlines tab');
assert(factSheetModal.includes('handleCopyDin'), 'ClientFactSheetModal must support copying DINs');
assert(factSheetModal.includes('clientApi.syncComplianceDeadlines'), 'ClientFactSheetModal must support syncing deadlines to calendar');

// 2. Verify ClientWorkspacePage has Compliance views
assert(workspacePage.includes('MCA21 Compliance Registry & Filings'), 'ClientWorkspacePage must render MCA21 compliance header');
assert(workspacePage.includes('Directors Registry & Signatories'), 'ClientWorkspacePage must render Directors Registry table');
assert(workspacePage.includes('Past Statutory Filings History'), 'ClientWorkspacePage must render Past Filings History table');
assert(workspacePage.includes('Automated Statutory Deadlines (Companies Act, 2013)'), 'ClientWorkspacePage must render automated compliance deadlines');
assert(workspacePage.includes('handleSyncDeadlines'), 'ClientWorkspacePage must support syncing deadlines to calendar');

// 3. Verify client.api.js exports syncComplianceDeadlines
assert(clientApi.includes('syncComplianceDeadlines:'), 'clientApi must export syncComplianceDeadlines');

// 4. Verify case.controller.js attaches mcaDossier to factSheetData
assert(caseController.includes('mcaDossier: client.mcaDossier || null'), 'case.controller must provide mcaDossier in factSheetData');

// 5. Verify client routes schema includes POST /:clientId/mca/sync-deadlines
assert(clientRoutesSchema.includes("'POST /:clientId/mca/sync-deadlines'"), 'client.routes.schema must validate POST /:clientId/mca/sync-deadlines');

console.log('✓ mcaFactSheetRegistry.test.mjs passed successfully!');
