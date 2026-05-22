#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const apiSource = fs.readFileSync(path.join(repoRoot, 'src', 'api', 'auth.api.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'marketing', 'Signup.jsx'), 'utf8');

assert(apiSource.includes('turnstileToken'), 'Signup init payload should include turnstileToken.');
assert(pageSource.includes('VITE_TURNSTILE_SITE_KEY'), 'Signup should use VITE_TURNSTILE_SITE_KEY.');
assert(!apiSource.includes('TURNSTILE_SECRET_KEY'), 'Frontend must not include TURNSTILE_SECRET_KEY.');
assert(!pageSource.includes('TURNSTILE_SECRET_KEY'), 'Frontend must not include TURNSTILE_SECRET_KEY.');

console.log('turnstileSignupPayload.static.test.mjs passed');
