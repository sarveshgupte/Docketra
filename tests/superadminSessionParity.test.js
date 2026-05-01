const assert = require('assert');

function createRes(cookieJar) {
  const state = { statusCode: 200, body: null, setCookies: [], clearedCookies: [] };
  return {
    state,
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return this; },
    cookie(name, value, options = {}) { state.setCookies.push({ name, value, options }); cookieJar[name] = value; return this; },
    clearCookie(name, options = {}) { state.clearedCookies.push({ name, options }); delete cookieJar[name]; return this; },
  };
}

async function run() {
  const jar = {};

  const loginRes = createRes(jar);
  loginRes.cookie('accessToken', 'sa-access', { httpOnly: true, path: '/' });
  loginRes.cookie('refreshToken', 'sa-refresh-1', { httpOnly: true, path: '/' });
  loginRes.status(200).json({ success: true, data: { role: 'SUPERADMIN', firmId: null, firmSlug: null } });
  assert.strictEqual(loginRes.state.statusCode, 200);
  assert(jar.accessToken && jar.refreshToken);

  const profileRes = createRes(jar);
  profileRes.status(200).json({ success: true, data: { role: 'SUPERADMIN', isSuperAdmin: true, firmId: null, firmSlug: null } });
  assert.strictEqual(profileRes.state.body.data.role, 'SUPERADMIN');

  const refreshRes = createRes(jar);
  refreshRes.cookie('accessToken', 'sa-access-2', { httpOnly: true, path: '/' });
  refreshRes.cookie('refreshToken', 'sa-refresh-2', { httpOnly: true, path: '/' });
  refreshRes.status(200).json({ success: true, message: 'Token refreshed successfully' });
  assert(refreshRes.state.setCookies.some((c) => c.name === 'accessToken'));
  assert(refreshRes.state.setCookies.some((c) => c.name === 'refreshToken'));

  const logoutRes = createRes(jar);
  logoutRes.clearCookie('accessToken', { path: '/' });
  logoutRes.clearCookie('refreshToken', { path: '/' });
  logoutRes.status(200).json({ success: true });
  assert(logoutRes.state.clearedCookies.some((c) => c.name === 'accessToken'));
  assert(logoutRes.state.clearedCookies.some((c) => c.name === 'refreshToken'));

  console.log('superadminSessionParity.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
