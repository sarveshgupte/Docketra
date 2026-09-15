#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modalSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'marketing', 'PilotAgreementModal.jsx'), 'utf8');
const signupPageSource = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'marketing', 'Signup.jsx'), 'utf8');
const authApiSource = fs.readFileSync(path.join(repoRoot, 'src', 'api', 'auth.api.js'), 'utf8');
const authServiceSource = fs.readFileSync(path.join(repoRoot, 'src', 'services', 'authService.js'), 'utf8');
const authContextSource = fs.readFileSync(path.join(repoRoot, 'src', 'contexts', 'AuthContext.jsx'), 'utf8');

console.log('Testing PilotAgreementModal and Clickwrap Consent UI integration...');

// 1. Verify Founder Identity & Pre-Incorporation Capacity
assert(modalSource.includes('Sarvesh Gupte'), 'Modal must name Sarvesh Gupte as the platform operator.');
assert(modalSource.includes('pre-incorporation') || modalSource.includes('Pre-Incorporation'), 'Modal must declare pre-incorporation individual capacity.');
assert(modalSource.includes('Maharashtra, India'), 'Modal must state operator location in Maharashtra, India.');
assert(modalSource.includes('v1.0_pilot_2026'), 'Modal must specify terms version v1.0_pilot_2026.');

// 2. Verify 3 Months Free Evaluation Pilot Scope
assert(modalSource.includes('three (3) consecutive months') || modalSource.includes('3-Month Free Evaluation License'), 'Modal must clearly define the 3-month free evaluation license.');
assert(modalSource.includes('Zero Cost') || modalSource.includes('No subscription fees'), 'Modal must state zero cost during the pilot period.');

// 3. Verify Strict Statutory & Professional Liability Disclaimers
assert(modalSource.includes('NO LEGAL, COMPLIANCE, SECRETARIAL, OR ACCOUNTING ADVICE'), 'Modal must contain strict disclaimer that software is not legal/statutory advice.');
assert(modalSource.includes('not a law firm, company secretary practice, chartered accountancy firm'), 'Modal must explicitly disclaim professional firm status.');
assert(modalSource.includes('SOLE AND EXCLUSIVE RESPONSIBILITY'), 'Modal must state firm is solely responsible for compliance.');
assert(modalSource.includes('MCA/ROC') && modalSource.includes('GST') && modalSource.includes('Income Tax'), 'Modal must reference MCA/ROC, GST, and Income Tax statutory verifications.');

// 4. Verify As-Is Warranty and Liability Cap
assert(modalSource.includes('AS IS') && modalSource.includes('AS AVAILABLE'), 'Modal must disclaim warranties (AS IS / AS AVAILABLE).');
assert(modalSource.includes('INR ₹0') || modalSource.includes('ZERO INDIAN RUPEES'), 'Modal must enforce INR 0 liability cap during pilot.');
assert(modalSource.includes('Mumbai / Thane, Maharashtra, India'), 'Modal must establish exclusive dispute jurisdiction in Mumbai / Thane, Maharashtra.');

// 5. Verify India Data Hosting & BYOS Privacy Provisions
assert(modalSource.includes('India Data Residency') || modalSource.includes('India-based cloud storage'), 'Modal must detail India data residency posture.');
assert(modalSource.includes('Bring Your Own Storage (BYOS)') || modalSource.includes('BYOS'), 'Modal must mention BYOS capabilities.');
assert(modalSource.includes('Zero Data Monetization') || modalSource.includes('never sell, rent, monetize'), 'Modal must guarantee zero data sale/monetization.');
assert(modalSource.includes('ipAddress') && modalSource.includes('userAgent') && modalSource.includes('agreedAt'), 'Modal must document clickwrap audit logging.');

// 6. Verify Tab Switching & Modal Architecture
assert(modalSource.includes("activeTab === 'pilot'"), 'Modal must have pilot agreement tab.');
assert(modalSource.includes("activeTab === 'terms'"), 'Modal must have terms and disclaimers tab.');
assert(modalSource.includes("activeTab === 'privacy'"), 'Modal must have privacy policy tab.');
assert(modalSource.includes('role="dialog"') && modalSource.includes('aria-modal="true"'), 'Modal must implement accessible dialog role.');

// 7. Verify Signup.jsx Clickwrap Checkbox and Non-destructive Modal Triggers
assert(signupPageSource.includes('agreedToPilotTerms'), 'Signup page must maintain agreedToPilotTerms state.');
assert(signupPageSource.includes('PilotAgreementModal'), 'Signup page must import and render PilotAgreementModal.');
assert(signupPageSource.includes('openLegalModal'), 'Signup page must provide openLegalModal handler.');
assert(signupPageSource.includes('id="signup-terms-consent"'), 'Signup page must render consent checkbox with id.');
assert(signupPageSource.includes('disabled={loading || !agreedToPilotTerms'), 'Signup submit button must be disabled until terms are accepted.');
assert(signupPageSource.includes("nextErrors.agreedToPilotTerms"), 'Signup validation must require explicit agreement.');
assert(signupPageSource.includes('termsVersion: PILOT_TERMS_VERSION'), 'Signup payload must pass termsVersion.');

// 8. Verify Forwarding Through API Layers
assert(authApiSource.includes('agreedToPilotTerms'), 'authApi.signupInit must forward agreedToPilotTerms.');
assert(authServiceSource.includes('agreedToPilotTerms'), 'authService.signup must forward agreedToPilotTerms.');
assert(authContextSource.includes('agreedToPilotTerms'), 'AuthContext signup method must forward agreedToPilotTerms.');

console.log('✅ pilotAgreementModal.test.mjs passed successfully!');
