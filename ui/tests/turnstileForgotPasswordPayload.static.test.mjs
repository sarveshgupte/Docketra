#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const serviceSource = fs.readFileSync(path.join(repoRoot, 'src', 'services', 'authService.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ForgotPasswordPage.jsx'), 'utf8');

assert(serviceSource.includes('forgotPasswordInit: async (identifier, firmSlug, turnstileToken)'), 'forgotPasswordInit should accept turnstileToken.');
assert(serviceSource.includes("'/auth/forgot-password/init', { identifier, firmSlug, turnstileToken }"), 'forgotPasswordInit should send turnstileToken in payload.');
assert(pageSource.includes('VITE_TURNSTILE_SITE_KEY'), 'Forgot-password should use VITE_TURNSTILE_SITE_KEY.');
assert(pageSource.includes('window.turnstile.getResponse'), 'Forgot-password should use turnstile getResponse fallback.');
assert(pageSource.includes('isTurnstileConfigured && !effectiveTurnstileToken'), 'Forgot-password submit should block when Turnstile token is missing.');
assert(!serviceSource.includes('TURNSTILE_SECRET_KEY'), 'Frontend service must not reference TURNSTILE_SECRET_KEY.');
assert(!pageSource.includes('TURNSTILE_SECRET_KEY'), 'Forgot-password page must not reference TURNSTILE_SECRET_KEY.');

console.log('turnstileForgotPasswordPayload.static.test.mjs passed');
