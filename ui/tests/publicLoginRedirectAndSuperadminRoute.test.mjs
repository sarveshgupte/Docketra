import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/routes/PublicRoutes.jsx'), 'utf8');

assert.ok(
  source.includes('<Route path="/login" element={<Navigate to="/find-workspace" replace />} />'),
  'Public /login must redirect to /find-workspace.',
);

assert.ok(
  source.includes('<Route path="/superadmin/login" element={<LoginPage />} />'),
  'Superadmin login route must remain available.',
);

console.log('publicLoginRedirectAndSuperadminRoute.test.mjs passed');
