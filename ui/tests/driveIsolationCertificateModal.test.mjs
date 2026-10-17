import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolveUi = (relPath) => path.resolve(__dirname, '..', relPath);

const modalFilePath = resolveUi('src/components/storage/DriveIsolationCertificateModal.jsx');
const storageSettingsPagePath = resolveUi('src/pages/StorageSettingsPage.jsx');
const platformCssPath = resolveUi('src/components/platform/platform.css');

// 1. Verify DriveIsolationCertificateModal.jsx exists and has required structure
assert.ok(fs.existsSync(modalFilePath), 'DriveIsolationCertificateModal.jsx should exist');
const modalCode = fs.readFileSync(modalFilePath, 'utf8');

assert.ok(modalCode.includes('export function DriveIsolationCertificateModal'), 'Should export DriveIsolationCertificateModal');
assert.ok(modalCode.includes('role="dialog"'), 'Should contain role="dialog"');
assert.ok(modalCode.includes('aria-modal="true"'), 'Should contain aria-modal="true"');
assert.ok(modalCode.includes('overscroll-contain'), 'Should contain overscroll-contain for modal accessibility');
assert.ok(modalCode.includes('CERTIFICATE OF CLOUD STORAGE ISOLATION'), 'Should contain official certificate title');
assert.ok(modalCode.includes('drive.file'), 'Should reference drive.file scope');
assert.ok(modalCode.includes('Cryptographic Proof Hash'), 'Should display cryptographic proof hash');
assert.ok(modalCode.includes('window.print()'), 'Should support 1-click print / PDF export');
assert.ok(modalCode.includes('no-print'), 'Should mark UI buttons with no-print class');
assert.ok(modalCode.includes('isolation-certificate-sheet'), 'Should have isolation-certificate-sheet class for printable bounds');

// 2. Verify StorageSettingsPage integration
assert.ok(fs.existsSync(storageSettingsPagePath), 'StorageSettingsPage.jsx should exist');
const pageCode = fs.readFileSync(storageSettingsPagePath, 'utf8');

assert.ok(pageCode.includes("import { DriveIsolationCertificateModal } from '../components/storage/DriveIsolationCertificateModal'"), 'Should import DriveIsolationCertificateModal in StorageSettingsPage');
assert.ok(pageCode.includes('<DriveIsolationCertificateModal'), 'Should render DriveIsolationCertificateModal in StorageSettingsPage');
assert.ok(pageCode.includes('handleOpenCertificate'), 'Should define handleOpenCertificate handler');
assert.ok(pageCode.includes('Print Isolation Certificate'), 'Should have Print Isolation Certificate button');
assert.ok(pageCode.includes('Isolation Certificate'), 'Should have Isolation Certificate action button');

// 3. Verify CSS Print styles in platform.css
assert.ok(fs.existsSync(platformCssPath), 'platform.css should exist');
const cssContent = fs.readFileSync(platformCssPath, 'utf8');

assert.ok(cssContent.includes('@media print'), 'Should have @media print block');
assert.ok(cssContent.includes('.isolation-certificate-sheet'), 'Should style .isolation-certificate-sheet in print');
assert.ok(cssContent.includes('.no-print'), 'Should hide .no-print elements in print');

console.log('driveIsolationCertificateModal.test.mjs passed');
