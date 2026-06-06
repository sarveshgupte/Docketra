#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

function printUsageAndExit() {
  console.error('Usage: node scripts/run-node-tests.js [KEY=value ...] -- tests/example.test.js [...]');
  process.exit(1);
}

const separatorIndex = process.argv.indexOf('--');
if (separatorIndex === -1) printUsageAndExit();

const envPairs = process.argv.slice(2, separatorIndex);
const testFiles = process.argv.slice(separatorIndex + 1);
if (testFiles.length === 0) printUsageAndExit();

const env = { ...process.env };
for (const pair of envPairs) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(pair);
  if (!match) {
    console.error(`Invalid env assignment: ${pair}`);
    printUsageAndExit();
  }
  env[match[1]] = match[2];
}

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, [testFile], {
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
