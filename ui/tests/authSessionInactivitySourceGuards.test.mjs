import fs from 'fs';
import path from 'path';
import assert from 'assert';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd
  ? path.resolve(process.cwd(), 'src')
  : path.resolve(process.cwd(), 'ui/src');

const constantsSource = fs.readFileSync(path.join(root, 'utils', 'constants.js'), 'utf8');
const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');

assert(
  constantsSource.includes('export const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000;'),
  'SESSION_IDLE_TIMEOUT_MS must be set to 3 hours.'
);
assert(
  constantsSource.includes('export const SESSION_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;'),
  'SESSION_KEEPALIVE_INTERVAL_MS must remain centralized in constants.'
);
assert(
  authContextSource.includes('if (!isAuthenticated) {'),
  'AuthContext inactivity effect must gate timer/listener setup behind isAuthenticated.'
);
assert(
  authContextSource.includes('return undefined;'),
  'AuthContext inactivity effect should early-return when unauthenticated.'
);
assert(
  authContextSource.includes("const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];"),
  'AuthContext should define explicit user activity events for idle timer reset.'
);
assert(
  authContextSource.includes('window.addEventListener(eventName, markActivity, { passive: true })'),
  'AuthContext must register activity listeners while authenticated.'
);
assert(
  authContextSource.includes('SESSION_IDLE_TIMEOUT_MS - idleDurationMs') || authContextSource.includes('}, SESSION_IDLE_TIMEOUT_MS);'),
  'Logout timer scheduling must derive from SESSION_IDLE_TIMEOUT_MS.'
);
assert(
  authContextSource.includes('}, SESSION_KEEPALIVE_INTERVAL_MS);'),
  'Keepalive interval must use SESSION_KEEPALIVE_INTERVAL_MS.'
);
assert(
  authContextSource.includes('if (keepaliveIntervalRef.current) {\n      window.clearInterval(keepaliveIntervalRef.current);\n      keepaliveIntervalRef.current = null;\n    }\n    keepaliveIntervalRef.current = window.setInterval('),
  'AuthContext should clear existing keepalive interval before creating a new one.'
);
assert(
  authContextSource.includes('if (idleTimeoutRef.current) {\n        window.clearTimeout(idleTimeoutRef.current);\n        idleTimeoutRef.current = null;\n      }'),
  'AuthContext cleanup should clear and null idle timeout references.'
);
assert(
  authContextSource.includes('events.forEach((eventName) => window.removeEventListener(eventName, markActivity));'),
  'AuthContext cleanup should remove activity listeners.'
);

console.log('auth session inactivity source guard tests passed');
