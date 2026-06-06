#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-placeholder-value-32ch';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.DISABLE_GOOGLE_AUTH = 'true';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';

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
  const routeGroups = read('../src/routes/routeGroups.js');
  const publicRoutes = read('../src/routes/public.routes.js');
  const serverSource = read('../src/app/routes/mountPlatformRoutes.js');

  assert.ok(authRoutes.includes("router.post('/verify-totp', otpVerifyLimiter, verifyTotp);"));
  assert.ok(authRoutes.includes("router.post('/complete-mfa-login', otpVerifyLimiter, completeMfaLogin);"));
  assert.ok(authRoutes.includes("router.post('/resend-otp', authBlockEnforcer, authLimiter, otpResendLimiter, attachFirmFromSlug, loginResend);"));

  assert.ok(publicSignupRoutes.includes("router.post('/resend-otp', deprecationHandler);"));
  assert.ok(publicSignupRoutes.includes("router.post('/verify-otp', deprecationHandler);"));
  assert.ok(publicSignupRoutes.includes("router.post('/initiate-signup', deprecationHandler);"));
  assert.ok(publicSignupRoutes.includes("router.post('/complete-signup', deprecationHandler);"));

  assert.ok(firmRoutes.includes("router.post('/login', loginLimiter, noFirmNoTransaction, setTenantLoginScope, login);"));
  assert.ok(firmRoutes.includes("router.post('/verify-otp', loginLimiter, noFirmNoTransaction, setTenantLoginScope, safeVerifyLoginOtp);"));
  assert.ok(!firmRoutes.includes('router.use(loginLimiter);'));

  assert.ok(clientRoutes.includes("router.get('/', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClients);"));
  assert.ok(clientRoutes.includes("router.post('/:clientId/change-name', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, changeLegalName);"));
  assert.ok(clientApprovalRoutes.includes("router.post('/:caseId/approve-new', authorizeFirmPermission('CLIENT_APPROVE'), sensitiveLimiter, checkClientApprovalPermission, approveNewClient);"));
  assert.ok(workTypeRoutes.includes("router.post('/', authorizeFirmPermission('WORKTYPE_MANAGE'), userWriteLimiter, createWorkType);"));
  assert.ok(securityRoutes.includes("router.get('/alerts', requireSuperadmin, superadminLimiter, listSecurityAlerts);"));
  assert.ok(dashboardRoutes.includes("router.get('/summary', userReadLimiter, getDashboardSummary);"));
  assert.ok(dashboardRoutes.includes("router.get('/risk-brief', userReadLimiter, getRiskBrief);"));
  assert.ok(routeGroups.includes('const firmReadAccess = [authenticate, userReadLimiter, attachFirmContext, requireTenant, buildFirmInvariantGuard()];'));
  assert.ok(routeGroups.includes('const adminTenantScopedApiAccess = [...tenantScopedApiAccess, requireAdmin];'));
  assert.ok(categoryRoutes.includes("router.get('/', ...firmReadAccess, authorizeFirmPermission('CATEGORY_VIEW'), getCategories);"));
  assert.ok(publicRoutes.includes("router.post('/signup', signupLimiter, async (req, res, next) => {"));

  assert.ok(serverSource.includes("app.get('/:firmSlug/login', publicLimiter, tenantResolver, firmLoginHandler);"));
  assert.ok(serverSource.includes("app.use('/api/admin', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), adminRoutes);"));
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
