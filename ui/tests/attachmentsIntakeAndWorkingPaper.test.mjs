import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8');

const attachmentsPanel = read('pages/caseDetail/CaseDetailAttachmentsPanel.jsx');
const reconciliationModal = read('pages/caseDetail/WorkingPaperReconciliationModal.jsx');
const landingPage = read('components/landing/LandingPageContent.jsx');
const securityPage = read('pages/marketing/Security.jsx');

// 1. Desktop Intake Tray & WhatsApp Auto-Tagging
assert.ok(attachmentsPanel.includes('handleDrop'), 'Attachments panel should handle file drag-and-drop.');
assert.ok(attachmentsPanel.includes('WHATSAPP_FORWARD'), 'Attachments panel should support WHATSAPP_FORWARD intake tagging.');
assert.ok(attachmentsPanel.includes('WhatsApp Forward'), 'Attachments panel should render WhatsApp Forward intake toggle.');
assert.ok(attachmentsPanel.includes('WorkingPaperReconciliationModal'), 'Attachments panel should integrate WorkingPaperReconciliationModal.');

// 2. Trainee Laptop Shield Working-Paper Reconciliation
assert.ok(reconciliationModal.includes('Trainee Laptop Shield: Safe Working-Paper Mode'), 'Reconciliation modal must render Trainee Shield protection notice.');
assert.ok(reconciliationModal.includes('parseCsv'), 'Reconciliation modal must support tabular CSV/TSV parsing.');
assert.ok(reconciliationModal.includes('filterQuery'), 'Reconciliation modal must support searching and filtering rows in real-time.');
assert.ok(reconciliationModal.includes('caseApi.getAttachmentBlob'), 'Reconciliation modal must safely stream attachment blob from storage.');

// 3. Sovereign Drive Isolation Certificate on Public Pages
assert.ok(landingPage.includes('DriveIsolationCertificateModal'), 'Landing page should integrate DriveIsolationCertificateModal.');
assert.ok(landingPage.includes('View Sovereign Drive Isolation Certificate'), 'Landing page should provide direct access to verify isolation certificate.');
assert.ok(securityPage.includes('DriveIsolationCertificateModal'), 'Security page should integrate DriveIsolationCertificateModal.');
assert.ok(securityPage.includes('Inspect Sovereign Certificate'), 'Security page should render certificate inspection trigger.');

console.log('attachmentsIntakeAndWorkingPaper.test.mjs passed successfully');
