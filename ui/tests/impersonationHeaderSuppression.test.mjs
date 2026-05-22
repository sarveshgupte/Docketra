import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'api.js'), 'utf8');

assert(apiSource.includes('isImpersonationSuppressedRoute'), 'API client must define impersonation suppression routing helper.');
['/superadmin', '/api/superadmin', '/auth', '/api/auth', '/login', '/logout', '/refresh', '/public', '/health'].forEach((segment) => {
  assert(apiSource.includes(segment), `Suppression rules should include ${segment}.`);
});
assert(apiSource.includes('localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);'), 'Auth failure cleanup should clear impersonation state.');

console.log('impersonationHeaderSuppression.test.mjs passed');
