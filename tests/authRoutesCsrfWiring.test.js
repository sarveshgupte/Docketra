const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
  assert(source.includes("router.use((req, res, next) => {"), 'auth routes should register a router-level middleware for method-based checks.');
  assert(source.includes("['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)"), 'auth routes should apply same-origin protection to state-changing methods.');
  assert(source.includes('enforceSameOriginForCookieAuth(req, res, next)'), 'auth routes should invoke same-origin CSRF enforcement.');
  console.log('authRoutesCsrfWiring.test.js passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
