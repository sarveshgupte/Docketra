const assert = require('assert');

(async () => {
  const mod = await import('../ui/src/utils/authRedirect.js');
  const { appendReturnTo, buildReturnTo, resolvePostLoginDestination } = mod;

  const returnTo = buildReturnTo({
    pathname: '/app/firm/acme/dockets',
    search: '?status=open',
    hash: '#table',
  });
  assert.strictEqual(returnTo, '/app/firm/acme/dockets?status=open#table');

  const loginWithReturnTo = appendReturnTo('/acme/login', '/app/firm/acme/dockets?status=open');
  assert.strictEqual(loginWithReturnTo, '/acme/login?returnTo=%2Fapp%2Ffirm%2Facme%2Fdockets%3Fstatus%3Dopen');

  const ignoredExternal = appendReturnTo('/acme/login', 'https://evil.test/phish');
  assert.strictEqual(ignoredExternal, '/acme/login');

  const resolvedSafe = resolvePostLoginDestination('/app/firm/acme/worklist', '/app/firm/acme/dashboard');
  assert.strictEqual(resolvedSafe, '/app/firm/acme/worklist');

  const resolvedUnsafe = resolvePostLoginDestination('//evil.test', '/app/firm/acme/dashboard');
  assert.strictEqual(resolvedUnsafe, '/app/firm/acme/dashboard');

  // eslint-disable-next-line no-console
  console.log('authRedirect util tests passed');
})().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

