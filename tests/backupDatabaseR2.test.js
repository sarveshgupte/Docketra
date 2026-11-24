'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../scripts/backup-database-r2.js');

// Test: Missing required configuration exits with code 1 and lists missing variables
const resultMissingCreds = spawnSync(process.execPath, [scriptPath], {
  env: {
    ...process.env,
    R2_ENDPOINT: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
    MONGO_URI: '',
    MONGODB_URI: '',
  },
  encoding: 'utf8',
});

assert.strictEqual(resultMissingCreds.status, 1, 'Should exit with code 1 when required config is missing');
const output = resultMissingCreds.stderr + resultMissingCreds.stdout;
assert(output.includes('[R2-BACKUP] Configuration error'), 'Should log configuration error');
assert(output.includes('R2_ENDPOINT'), 'Should report missing R2_ENDPOINT');
assert(output.includes('R2_ACCESS_KEY_ID'), 'Should report missing R2_ACCESS_KEY_ID');
assert(output.includes('R2_SECRET_ACCESS_KEY'), 'Should report missing R2_SECRET_ACCESS_KEY');

console.log('backupDatabaseR2 tests passed');
