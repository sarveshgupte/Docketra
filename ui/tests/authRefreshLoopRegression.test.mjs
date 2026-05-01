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
  apiSource.includes('skipAuthRedirect'),
  'API interceptor should support explicit skipAuthRedirect metadata for public-page profile checks.'
);
assert(
  apiSource.includes('isPublicAuthPage && isAuthStateRequest'),
  'API interceptor should suppress auth redirect/refresh handling for profile/refresh on public auth pages.'
);
assert(
  authContextSource.includes('authFailureResolvedRef'),
  'AuthContext should keep a resolved-unauthenticated guard to prevent repeated profile hydration loops.'
);
assert(
  authContextSource.includes('Skipping profile fetch after resolved unauthenticated state'),
  'AuthContext should explicitly short-circuit profile hydration after refresh failure.'
);
assert(
  authContextSource.includes('getProfile({ skipAuthRedirect: true })'),
  'AuthContext bootstrap profile hydration should skip interceptor-driven auth redirects.'
);
assert(
  authContextSource.includes('queryClient.clear();'),
  'AuthContext should clear private React Query cache when auth state is reset/logout.'
);
assert(
  authContextSource.includes("window.dispatchEvent(new CustomEvent('auth:logout'))"),
  'AuthContext should broadcast logout lifecycle events for socket/session cleanup.'
);
assert(
  authContextSource.includes('AUTH_LOGOUT_BROADCAST'),
  'AuthContext should emit and subscribe to a multi-tab logout broadcast key.'
);
assert(
  authContextSource.includes('window?.localStorage'),
  'AuthContext logout broadcast should guard browser storage access.'
);
assert(
  authContextSource.includes('Multi-tab broadcast is best-effort'),
  'AuthContext should keep logout finalization resilient when storage write fails.'
);

console.log('auth refresh loop regression tests passed');
