import fs from 'fs';
import path from 'path';
import assert from 'assert';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd
  ? path.resolve(process.cwd(), 'src')
  : path.resolve(process.cwd(), 'ui/src');
const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');
const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');

assert(
  apiSource.includes('&& !isRefreshRequest(originalRequest)'),
  'API interceptor must never trigger refresh recursion when /auth/refresh itself returns 401.'
);
assert(
  apiSource.includes('refreshFailureDetected = true;'),
  'API interceptor should short-circuit after refresh failure.'
);
assert(
  apiSource.includes('alreadyOnLoginRoute'),
  'API interceptor should avoid hard-redirect loops when the user is already on a login route.'
);
assert(
  authContextSource.includes('authFailureResolvedRef'),
  'AuthContext should keep a resolved-unauthenticated guard to prevent repeated profile hydration loops.'
);
assert(
  authContextSource.includes('Skipping profile fetch after resolved unauthenticated state'),
  'AuthContext should explicitly short-circuit profile hydration after refresh failure.'
);

console.log('auth refresh loop regression tests passed');
