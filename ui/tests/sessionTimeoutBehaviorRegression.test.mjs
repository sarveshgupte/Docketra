import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd ? path.resolve(process.cwd(), 'src') : path.resolve(process.cwd(), 'ui/src');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const authContextSource = read('contexts/AuthContext.jsx');
const apiSource = read('services/api.js');
const constantsSource = read('utils/constants.js');

assert.ok(constantsSource.includes('SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000'), 'Idle timeout must stay at 3 hours.');
assert.ok(authContextSource.includes("message: 'Session timed out'"), 'Idle logout should show explicit session timed out copy.');
assert.ok(authContextSource.includes('Date.now() - lastActivityAtRef.current'), 'Keepalive should compare idle duration against centralized threshold.');
assert.ok(authContextSource.includes('app:api-activity'), 'AuthContext should treat API activity as active session usage.');
assert.ok(authContextSource.includes('AUTH_LAST_ACTIVE_AT'), 'AuthContext should persist/share last active timestamp across tabs.');
assert.ok(authContextSource.includes('const checkIdleAndScheduleNext = () => {'), 'AuthContext should centralize idle checks and timer scheduling.');
assert.ok(authContextSource.includes('const callbackIdleDurationMs = Date.now() - lastActivityAtRef.current;'), 'Timeout callback should re-check idle duration before logout.');
assert.ok(authContextSource.includes('if (document.visibilityState !== \'visible\') return;'), 'Visibility handler should only run logic when tab becomes visible.');
assert.ok(authContextSource.includes('if (idleDurationMs >= SESSION_IDLE_TIMEOUT_MS) {'), 'Visibility return should enforce idle timeout before activity refresh.');
assert.ok(authContextSource.includes('parsed > lastActivityAtRef.current'), 'Cross-tab activity handling should ignore stale timestamps.');
assert.ok(apiSource.includes("message: 'Your session has expired. Please sign in again.'"), '401 auth expiry should not be mislabeled as inactivity timeout.');
assert.ok(apiSource.includes('if (status === 403)'), '403 handling must be explicit and non-logout.');
assert.ok(apiSource.includes('if (!hasResponse)'), 'Network failures should use retry/fallback logic, not forced logout.');
assert.ok(apiSource.includes('await api.post(\'/auth/refresh\')'), '401 handling should attempt refresh before logout.');
assert.ok(apiSource.includes('config?.metadata?.userInitiatedActivity === true'), 'Only explicitly user-initiated API calls should emit idle-refresh API activity.');

console.log('sessionTimeoutBehaviorRegression.test.mjs passed');
