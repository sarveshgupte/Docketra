import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const adminPage = fs.readFileSync(path.join(workspaceRoot, 'src', 'pages', 'AdminPage.jsx'), 'utf8');
const adminClientsSection = fs.readFileSync(path.join(workspaceRoot, 'src', 'pages', 'admin', 'components', 'AdminClientsSection.jsx'), 'utf8');

assert(adminPage.includes('clientApi.sendClientStatusOtp'), 'Admin page should send a client status OTP before activation changes.');
assert(adminPage.includes('clientApi.verifyClientStatusOtp'), 'Admin page should verify a client status OTP before activation changes.');
assert(adminPage.includes('clientApi.toggleClientStatus('), 'Admin page should still call the client status API after OTP verification.');
assert(adminPage.includes('clientStatusVerificationToken'), 'Admin page should require a verification token before confirming client status changes.');
assert(adminPage.includes('Verify with OTP to'), 'Admin page should explain the OTP and audit requirement.');
assert(adminClientsSection.includes('Deactivate') && adminClientsSection.includes('Activate'), 'Admin clients section should render explicit activate/deactivate actions.');
assert(adminClientsSection.includes('!isProtectedClient(c)'), 'Admin clients section should hide activate/deactivate actions for protected default clients.');

console.log('adminClientStatusOtpFlow.test.mjs passed');
