const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
  assert(source.includes("const { enforceSameOriginForMutatingRequests } = require('./middleware/csrfOrigin.middleware');"), 'server should import global CSRF/origin mutating middleware.');
  assert(source.includes('app.use(enforceSameOriginForMutatingRequests);'), 'server should apply CSRF/origin guard globally before API routes.');
  console.log('serverCsrfMutationWiring.test.js passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
