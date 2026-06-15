import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const clientsPage = read('ui/src/pages/ClientsPage.jsx');
const clientApi = read('ui/src/api/client.api.js');
const clientRoutes = read('src/routes/client.routes.js');
const clientSchemas = read('src/schemas/client.routes.schema.js');
const clientController = read('src/controllers/client.controller.js');

assert(clientsPage.includes('Send Code'), 'Clients page should provide a send OTP action before status changes.');
assert(clientsPage.includes("Verifying…' : 'Verify'"), 'Clients page should provide an OTP verification action before status changes.');
assert(clientsPage.includes('statusVerificationToken'), 'Clients page should require a verification token before confirming status changes.');
assert(clientsPage.includes('clientApi.sendClientStatusOtp'), 'Clients page should send a dedicated client status OTP.');
assert(clientsPage.includes('clientApi.verifyClientStatusOtp'), 'Clients page should verify the dedicated client status OTP.');
assert(clientApi.includes("http.post(`/clients/${clientId}/status/send-otp`, {})"), 'Client API should expose status OTP send.');
assert(clientApi.includes("http.post(`/clients/${clientId}/status/verify-otp`, { otp })"), 'Client API should expose status OTP verify.');
assert(clientApi.includes("http.patch(`/clients/${clientId}/status`, { isActive, verificationToken })"), 'Client API should include verificationToken when toggling status.');
assert(clientRoutes.includes("router.post('/:clientId/status/send-otp'"), 'Client routes should expose status OTP send.');
assert(clientRoutes.includes("router.post('/:clientId/status/verify-otp'"), 'Client routes should expose status OTP verify.');
assert(clientSchemas.includes("'POST /:clientId/status/send-otp'"), 'Client route schema should validate status OTP send.');
assert(clientSchemas.includes("'POST /:clientId/status/verify-otp'"), 'Client route schema should validate status OTP verify.');
assert(clientController.includes('CLIENT_STATUS_OTP_PURPOSE'), 'Client controller should use a dedicated OTP purpose for status changes.');
assert(clientController.includes("actionType: 'ClientStatusChanged'"), 'Client status changes should be written to auth audit history.');

console.log('clientsStatusOtpFlow.test.mjs passed');
