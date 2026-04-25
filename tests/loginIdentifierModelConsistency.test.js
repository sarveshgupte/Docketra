#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const routeSchemas = require('../src/schemas/auth.routes.schema');
const { xidString } = require('../src/schemas/common');

const validXID = 'X123456';
const invalidLegacyDK = 'DK-ABCDE';

(() => {
  assert.doesNotThrow(() => xidString.parse(validXID), 'backend xidString must accept X123456 format');
  assert.throws(() => xidString.parse(invalidLegacyDK), 'backend xidString must reject legacy DK-XXXXX format');
})();

(() => {
  const loginSchema = routeSchemas['POST /login/init'].body;
  assert.doesNotThrow(() => loginSchema.parse({ firmSlug: 'acme', xid: validXID, password: 'Correct#123' }));
  assert.throws(() => loginSchema.parse({ firmSlug: 'acme', xid: invalidLegacyDK, password: 'Correct#123' }));
})();

(() => {
  const sendOtpSchema = routeSchemas['POST /send-otp'].body;
  assert.doesNotThrow(() => sendOtpSchema.parse({ xid: validXID, purpose: 'login' }));
  assert.throws(() => sendOtpSchema.parse({ xid: invalidLegacyDK, purpose: 'login' }));
})();

(() => {
  const forgotSchema = routeSchemas['POST /forgot-password/init'].body;
  assert.doesNotThrow(() => forgotSchema.parse({ firmSlug: 'acme', identifier: validXID }));
  assert.throws(() => forgotSchema.parse({ firmSlug: 'acme', identifier: invalidLegacyDK }));
})();

(() => {
  const uiValidatorSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'src', 'utils', 'validators.js'), 'utf8');
  assert(
    /const xidRegex = \/\^\[xX\]\\d\{6\}\$\/;/.test(uiValidatorSource),
    'frontend validateXID must enforce X + 6 digits only',
  );
})();

(() => {
  const authControllerSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'), 'utf8');
  assert(
    authControllerSource.includes('xID: inviteState.xID'),
    'invite flow must persist generated visible xID on created users',
  );
})();

(() => {
  const authServiceSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'src', 'services', 'authService.js'), 'utf8');
  assert(
    authServiceSource.includes("forgotPasswordInit: async (identifier, firmSlug) =>"),
    'forgot-password frontend service should submit identifier consistently',
  );
})();

console.log('login identifier model consistency tests passed');
