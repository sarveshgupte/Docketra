import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8');

const certModalSource = read('components/superadmin/LegalConsentCertificateModal.jsx');
const dashboardSource = read('pages/SuperadminDashboard.jsx');
const controllerSource = fs.readFileSync(path.resolve(__dirname, '../../src/controllers/superadmin.controller.js'), 'utf8');

// 1. Legal Consent Certificate Modal Contract
assert.ok(
  certModalSource.includes('LegalConsentCertificateModal')
    && certModalSource.includes('Electronic Legal Consent Record')
    && certModalSource.includes('Practice Entity')
    && certModalSource.includes('Primary Authorized Signatory')
    && certModalSource.includes('termsVersion')
    && certModalSource.includes('agreementType')
    && certModalSource.includes('handlePrint')
    && certModalSource.includes('handleCopyDigest'),
  'LegalConsentCertificateModal should render practice details, signatory, and verification metadata.'
);

// 2. Superadmin Dashboard Legal Registry Tab
assert.ok(
  dashboardSource.includes("id: 'legal', label: 'Legal & Consent'")
    && dashboardSource.includes("activeTab === 'legal'")
    && dashboardSource.includes('Total Registered Firms')
    && dashboardSource.includes('Signed Clickwrap Terms')
    && dashboardSource.includes('Pending / Legacy Accounts')
    && dashboardSource.includes('Firm Legal Consent Audit Ledger')
    && dashboardSource.includes('LegalConsentCertificateModal')
    && dashboardSource.includes('setSelectedCertFirm')
    && dashboardSource.includes('📄 View Certificate'),
  'SuperadminDashboard should include the Legal & Consent tab, KPI cards, audit ledger, and certificate modal trigger.'
);

// 3. Backend Controller Agreement Type Mapping
assert.ok(
  controllerSource.includes("agreementType: firm.legalConsent?.agreementType || (resolvedTermsAccepted ? 'PILOT_CLICKWRAP' : null)"),
  'Superadmin controller should expose agreementType across tenant firm queries.'
);

console.log('superadminLegalConsent.test.mjs passed successfully');
