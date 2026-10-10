#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { signGoogleState, parseGoogleState } = require('../src/services/authGoogle.service');
const authRoutesSchema = require('../src/schemas/auth.routes.schema');

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars-long';

// 1. Verify signGoogleState and parseGoogleState preserve workspace signup payload
const statePayload = {
  nonce: '12345',
  intent: 'signup',
  mode: 'workspace_signup',
  firmSlug: null,
  setupToken: null,
  firmName: 'Apex Law & Associates',
  phone: '9876543210',
  agreedToPilotTerms: true,
  issuedAt: Date.now(),
};

const signedState = signGoogleState(statePayload);
assert.ok(typeof signedState === 'string' && signedState.includes('.'), 'State must be signed with HMAC signature');
const parsed = parseGoogleState(signedState);
assert.deepStrictEqual(parsed.intent, 'signup', 'State intent must match');
assert.deepStrictEqual(parsed.mode, 'workspace_signup', 'State mode must match');
assert.deepStrictEqual(parsed.firmName, 'Apex Law & Associates', 'Firm name must be preserved');
assert.deepStrictEqual(parsed.phone, '9876543210', 'Phone must be preserved');
assert.deepStrictEqual(parsed.agreedToPilotTerms, true, 'Terms agreement must be preserved');

// 2. Verify auth routes schema for GET /google/start and POST /google/complete-signup
const startSchema = authRoutesSchema['GET /google/start'];
assert.ok(startSchema, 'GET /google/start schema must exist');
const validStartQuery = startSchema.query.parse({
  intent: 'signup',
  firmName: 'Apex Legal',
  phone: '9876543210',
});
assert.strictEqual(validStartQuery.intent, 'signup');
assert.strictEqual(validStartQuery.firmName, 'Apex Legal');

const completeSignupSchema = authRoutesSchema['POST /google/complete-signup'];
assert.ok(completeSignupSchema, 'POST /google/complete-signup schema must exist');
const validCompleteBody = completeSignupSchema.body.parse({
  googlePendingToken: signedState,
  firmName: 'Apex Legal',
  phone: '9876543210',
  agreedToPilotTerms: true,
});
assert.strictEqual(validCompleteBody.firmName, 'Apex Legal');

// 3. Verify Frontend Signup.jsx includes Google auth button and handler
const signupSource = fs.readFileSync(path.join(__dirname, '../ui/src/pages/marketing/Signup.jsx'), 'utf8');
assert.ok(signupSource.includes('handleGoogleSignup'), 'Signup.jsx must define handleGoogleSignup handler');
assert.ok(signupSource.includes('Create account with Google'), 'Signup.jsx must render "Create account with Google" CTA');
assert.ok(signupSource.includes('auth/google/start'), 'Signup.jsx must initiate auth at /auth/google/start');

// 4. Verify Frontend OAuthPostAuthPage.jsx handles signup_pending
const postAuthSource = fs.readFileSync(path.join(__dirname, '../ui/src/pages/OAuthPostAuthPage.jsx'), 'utf8');
assert.ok(postAuthSource.includes("mode === 'signup_pending'"), 'OAuthPostAuthPage must handle signup_pending mode');
assert.ok(postAuthSource.includes('completeGoogleSignup'), 'OAuthPostAuthPage must call completeGoogleSignup');
assert.ok(postAuthSource.includes('Name your workspace'), 'OAuthPostAuthPage must render workspace naming UI');

// 5. Verify Frontend auth.api.js defines completeGoogleSignup
const authApiSource = fs.readFileSync(path.join(__dirname, '../ui/src/api/auth.api.js'), 'utf8');
assert.ok(authApiSource.includes('completeGoogleSignup:'), 'auth.api.js must export completeGoogleSignup');
assert.ok(authApiSource.includes('/auth/google/complete-signup'), 'auth.api.js must call /auth/google/complete-signup');

console.log('✅ googleWorkspaceSignup.test.js passed successfully!');
