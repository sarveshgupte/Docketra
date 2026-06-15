#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targets = ['src', 'tests'];
let hasError = false;

function walk(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      files = files.concat(walk(filePath));
    } else if (file.endsWith('.js')) {
      files.push(filePath);
    }
  }
  return files;
}

const jsFiles = [];
for (const target of targets) {
  const targetPath = path.resolve(process.cwd(), target);
  if (fs.existsSync(targetPath)) {
    if (fs.statSync(targetPath).isDirectory()) {
      jsFiles.push(...walk(targetPath));
    } else if (targetPath.endsWith('.js')) {
      jsFiles.push(targetPath);
    }
  }
}

console.log(`Checking syntax of ${jsFiles.length} JavaScript files...`);

for (const file of jsFiles) {
  const result = spawnSync('node', ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Syntax check failed for file: ${file}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ Syntax checks passed.');
}
