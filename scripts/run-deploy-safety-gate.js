#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  UPLOAD_SCAN_STRICT: 'true',
  AUTH_DEBUG_DIAGNOSTICS: 'false',
  REDIS_URL: '',
  ALLOW_REDIS_FALLBACK: 'true',
  JWT_SECRET: 'a'.repeat(72),
  JWT_PASSWORD_SETUP_SECRET: 'b'.repeat(72),
  STORAGE_TOKEN_SECRET: 'c'.repeat(72),
  METRICS_TOKEN: 'd'.repeat(72),
  MASTER_ENCRYPTION_KEY: 'e'.repeat(64),
  SUPERADMIN_PASSWORD_HASH: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  SUPERADMIN_XID: 'X000001',
  SUPERADMIN_EMAIL: 'superadmin@example.com',
  SUPERADMIN_OBJECT_ID: '000000000000000000000001',
  MONGO_URI: 'mongodb://127.0.0.1:27017/docketra',
  ENCRYPTION_PROVIDER: 'local',
  MAIL_FROM: 'no-reply@example.com',
  BREVO_API_KEY: 'ci-mail-provider-key',
  DISABLE_GOOGLE_AUTH: 'true',
  ENABLE_EXTERNAL_STORAGE: 'false',
};

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const npmArgs = (scriptName) => (npmCli ? [npmCli, 'run', scriptName] : ['run', scriptName]);
const commands = [
  [npmCommand, npmArgs('validate:env:production')],
  [npmCommand, npmArgs('validate:env:test')],
  [process.execPath, ['tests/routeValidationContract.test.js']],
  [process.execPath, ['tests/backendRuntimeEntrypoints.smoke.test.js']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell: false });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
