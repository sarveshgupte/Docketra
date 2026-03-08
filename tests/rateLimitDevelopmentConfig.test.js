#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const config = require('../src/config/config');

function read(relativePath) {
  return fs.readFileSync(require.resolve(relativePath), 'utf8');
}

function testDevelopmentFriendlyDefaults() {
  const rateLimit = config.security.rateLimit;

  assert.strictEqual(rateLimit.global, 1000);
  assert.strictEqual(rateLimit.globalWindowSeconds, 60);
  assert.strictEqual(rateLimit.publicPerMinute, 500);
  assert.strictEqual(rateLimit.auth, 100);
  assert.strictEqual(rateLimit.loginPerMinute, 75);
  assert.strictEqual(rateLimit.signupPerHour, 100);
  assert.strictEqual(rateLimit.otpVerifyPerMinute, 30);
  assert.strictEqual(rateLimit.otpResendPerMinute, 10);
  assert.strictEqual(rateLimit.userReadPerMinute, 300);
  assert.strictEqual(rateLimit.userWritePerMinute, 150);
  assert.strictEqual(rateLimit.searchPerMinute, 150);
  console.log('  ✓ centralizes development-friendly rate-limit defaults in config');
}

function testRouteLimiterWiring() {
  const authRoutes = read('../src/routes/auth.routes.js');
  const publicSignupRoutes = read('../src/routes/publicSignup.routes.js');
  const firmRoutes = read('../src/routes/firm.routes.js');
  const clientRoutes = read('../src/routes/client.routes.js');
  const clientApprovalRoutes = read('../src/routes/clientApproval.routes.js');
  const workTypeRoutes = read('../src/routes/workType.routes.js');
  const securityRoutes = read('../src/routes/security.routes.js');
  const dashboardRoutes = read('../src/routes/dashboard.routes.js');
  const categoryRoutes = read('../src/routes/category.routes.js');
  const inboundRoutes = read('../src/routes/inbound.routes.js');
  const publicRoutes = read('../src/routes/public.routes.js');
  const serverSource = read('../src/server.js');

  assert.ok(authRoutes.includes("router.post('/verify-totp', otpVerifyLimiter, verifyTotp);"));
  assert.ok(authRoutes.includes("router.post('/complete-mfa-login', otpVerifyLimiter, completeMfaLogin);"));
  assert.ok(authRoutes.includes("router.post('/resend-otp', authBlockEnforcer, authLimiter, otpResendLimiter, resendLoginOtp);"));

  assert.ok(publicSignupRoutes.includes("router.post('/resend-otp', otpResendLimiter, resendOtp);"));
  assert.ok(publicSignupRoutes.includes("router.post('/verify-otp', otpVerifyLimiter, wrapWriteHandler(verifyOtp));"));
  assert.ok(publicSignupRoutes.includes("router.post('/initiate-signup', wrapWriteHandler(initiateSignup));"));

  assert.ok(firmRoutes.includes("router.post('/login', loginLimiter, noFirmNoTransaction, setTenantLoginScope, login);"));
  assert.ok(firmRoutes.includes("router.post('/verify-otp', otpVerifyLimiter, noFirmNoTransaction, setTenantLoginScope, verifyLoginOtp);"));
  assert.ok(!firmRoutes.includes('router.use(loginLimiter);'));

  assert.ok(clientRoutes.includes("router.get('/', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClients);"));
  assert.ok(clientRoutes.includes("router.post('/:clientId/change-name', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, changeLegalName);"));
  assert.ok(clientApprovalRoutes.includes("router.post('/:caseId/approve-new', authorizeFirmPermission('CLIENT_APPROVE'), sensitiveLimiter, checkClientApprovalPermission, approveNewClient);"));
  assert.ok(workTypeRoutes.includes("router.post('/', authorizeFirmPermission('WORKTYPE_MANAGE'), userWriteLimiter, createWorkType);"));
  assert.ok(securityRoutes.includes("router.get('/alerts', requireSuperadmin, superadminLimiter, listSecurityAlerts);"));
  assert.ok(dashboardRoutes.includes("router.get('/summary', userReadLimiter, getDashboardSummary);"));
  assert.ok(categoryRoutes.includes("router.get('/', publicLimiter, getCategories);"));
  assert.ok(inboundRoutes.includes("router.post('/email', inboundEmailLimiter, inboundStorageHealthGuard, handleInboundEmail);"));
  assert.ok(publicRoutes.includes("router.post('/signup', signupLimiter, async (req, res, next) => {"));

  assert.ok(serverSource.includes("app.get('/:firmSlug/login', publicLimiter, tenantResolver, (req, res) => {"));
  assert.ok(!serverSource.includes('const superadminRouteLimiter = rateLimit({'));
  assert.ok(!serverSource.includes("app.use('/api/admin', authenticate, firmContext, requireTenant, tenantThrottle, sensitiveLimiter"));
  console.log('  ✓ wires updated route-level limiters and removes redundant throttles');
}

function run() {
  testDevelopmentFriendlyDefaults();
  testRouteLimiterWiring();
  console.log('rateLimitDevelopmentConfig tests passed.');
}

run();
