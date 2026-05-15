#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'ui/src/pages/marketing/Signup.jsx'), 'utf8');
assert.ok(source.includes('ROUTES.DASHBOARD(firmSlug)'), 'authenticated users with firm slug should be redirected to dashboard');
assert.ok(source.includes("navigate('/find-workspace', { replace: true })"), 'authenticated users without firm slug should be redirected safely');

console.log('signupPageAuthenticatedRedirect.ui.test.js passed');
