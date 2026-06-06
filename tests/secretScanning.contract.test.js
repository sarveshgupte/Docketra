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
  assert.match(workflow, /npm ci/, 'secret-scanning workflow must install dependencies with npm ci before checks');
  assert.match(workflow, /npm run security:secrets/, 'secret-scanning workflow must run npm run security:secrets');

  const packageJson = JSON.parse(read('package.json'));
  assert.strictEqual(
    packageJson.scripts['security:secrets'],
    'node scripts/run-secret-scan.js',
    'security:secrets script must invoke the cross-platform Node secret scanner'
  );
  ['ci:backend:security', 'test:security:pure', 'test:hardening:pure', 'test:tenant-identity-boundary', 'test:admin-tenant-boundary', 'ci:backend:deploy-safety'].forEach((scriptName) => {
    const script = packageJson.scripts[scriptName];
    assert.ok(script, `${scriptName} must exist`);
    assert.ok(!/\bsh\s+-c\b|bash\s+|^[A-Z_]+='?[^ ]*'?\s/.test(script), `${scriptName} must not rely on POSIX shell env assignment`);
  });
  assert.ok(packageJson.scripts['validate:env:production:fixture'], 'production fixture validation script must be available');


  const runnerScript = read('scripts/run-secret-scan.js');
  assert.match(runnerScript, /GITLEAKS_VERSION = '8\.24\.2'/, 'Node secret scanner must pin the gitleaks version');
  assert.match(runnerScript, /createTrackedSnapshot/, 'Node secret scanner must scan a git-tracked snapshot instead of ignored local env files');
  assert.match(runnerScript, /GITHUB_ACTIONS[\s\S]*docker/, 'Node secret scanner must preserve Docker fallback in GitHub Actions');
  assert.match(runnerScript, /installGitleaks/, 'Node secret scanner must support platform-specific downloaded binaries');

  const gitleaksConfig = read('.gitleaks.toml');
  assert.ok(gitleaksConfig.includes("'''<required-[^>]+>'''"), 'gitleaks allowlist must include required placeholder patterns');
  assert.ok(gitleaksConfig.includes("'''<db-host>'''"), 'gitleaks allowlist must include db placeholder patterns');

  const gitignore = read('.gitignore');
  ['rewrite_auth*.js', 'debug_auth*.js', 'auth_debug*.js', 'patch.diff', 'load-tests/'].forEach((pattern) => {
    assert.ok(gitignore.includes(pattern), `.gitignore must block future scratch artifact ${pattern}`);
  });

  console.log('secret scanning contract checks passed');
})();
