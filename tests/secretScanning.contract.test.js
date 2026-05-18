const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

(function run() {
  const workflow = read('.github/workflows/secret-scanning.yml');
  assert.match(workflow, /pull_request:/, 'secret-scanning workflow must run on pull_request');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/m, 'secret-scanning workflow must run on push to main');
  assert.match(workflow, /npm run security:secrets/, 'secret-scanning workflow must run npm run security:secrets');

  const packageJson = JSON.parse(read('package.json'));
  assert.strictEqual(
    packageJson.scripts['security:secrets'],
    'bash scripts/run-secret-scan.sh',
    'security:secrets script must invoke scripts/run-secret-scan.sh'
  );

  const gitleaksConfig = read('.gitleaks.toml');
  assert.ok(gitleaksConfig.includes("'''<required-[^>]+>'''"), 'gitleaks allowlist must include required placeholder patterns');
  assert.ok(gitleaksConfig.includes("'''<db-host>'''"), 'gitleaks allowlist must include db placeholder patterns');

  console.log('secret scanning contract checks passed');
})();
