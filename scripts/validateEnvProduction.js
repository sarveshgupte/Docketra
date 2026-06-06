#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { envSchema, maskEnvValue } = require('../src/config/env');
const { validateEnv } = require('../src/config/validateEnv');

const repoRoot = path.resolve(__dirname, '..');

function makeTestSecret(label, length = 72) {
  const seed = `validation-${label}-`;
  return seed + 'x'.repeat(Math.max(0, length - seed.length));
}

function makeTestBcryptHash() {
  return `$2b$10$${'a'.repeat(53)}`;
}

function makeFixtureEnv() {
  return {
    NODE_ENV: 'production',
    PORT: '5000',
    MONGO_URI: 'mongodb://127.0.0.1:27017/test',
    REDIS_URL: 'redis://127.0.0.1:6379',
    JWT_SECRET: makeTestSecret('jwt'),
    JWT_PASSWORD_SETUP_SECRET: makeTestSecret('jwt-password-setup'),
    SUPERADMIN_PASSWORD_HASH: makeTestBcryptHash(),
    SUPERADMIN_XID: 'X000001',
    SUPERADMIN_EMAIL: 'superadmin@example.com',
    SUPERADMIN_OBJECT_ID: '000000000000000000000001',
    ENCRYPTION_PROVIDER: 'local',
    MASTER_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    METRICS_TOKEN: makeTestSecret('metrics-token'),
    STORAGE_TOKEN_SECRET: makeTestSecret('storage-token'),
    UPLOAD_SCAN_STRICT: 'true',
    AUTH_DEBUG_DIAGNOSTICS: 'false',
    DISABLE_GOOGLE_AUTH: 'true',
    ENABLE_EXTERNAL_STORAGE: 'false',
    BREVO_API_KEY: 'fixture-mail-provider-key',
    MAIL_FROM: 'no-reply@example.com',
  };
}

function parseEnvYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const output = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[match[1]] = value;
  }
  return output;
}

function loadCurrentEnvFiles() {
  const loaded = [];
  const dotEnvPath = path.join(repoRoot, '.env');
  if (fs.existsSync(dotEnvPath)) {
    dotenv.config({ path: dotEnvPath, override: false });
    loaded.push('.env');
  }

  const yamlEnv = parseEnvYaml(path.join(repoRoot, 'env.yaml'));
  if (Object.keys(yamlEnv).length) {
    for (const [key, value] of Object.entries(yamlEnv)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push('env.yaml');
  }
  return loaded;
}

function formatIssues(issues, envSource) {
  return issues.map((issue) => {
    const field = issue.path.join('.') || 'unknown';
    return {
      field,
      reason: issue.message,
      received: maskEnvValue(field, envSource[issue.path[0]]),
    };
  });
}

function validateFixture() {
  const fixture = makeFixtureEnv();
  const parsed = envSchema.safeParse(fixture);
  if (!parsed.success) {
    console.error('Production fixture environment validation failed', {
      errors: formatIssues(parsed.error.issues, fixture),
    });
    process.exit(1);
  }
  console.log('Production fixture environment validation passed');
}

function validateCurrent() {
  const loaded = loadCurrentEnvFiles();
  process.env.NODE_ENV = 'production';
  const result = validateEnv({ exitOnError: false });
  if (!result.valid) {
    console.error('Production current environment validation failed', {
      loadedEnvFiles: loaded,
      errors: result.errors,
    });
    process.exit(1);
  }
  console.log('Production current environment validation passed', { loadedEnvFiles: loaded });
}

const mode = process.argv.includes('--fixture') ? 'fixture' : 'current';
if (mode === 'fixture') validateFixture();
else validateCurrent();
