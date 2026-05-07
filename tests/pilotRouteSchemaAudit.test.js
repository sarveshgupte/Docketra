#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesDir = path.join(__dirname, '..', 'src', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter((name) => name.endsWith('.js'));

const requiredExplicit = ['admin.routes.js', 'client.routes.js', 'case.routes.js'];
for (const file of requiredExplicit) {
  assert.ok(routeFiles.includes(file), `Missing required route file: ${file}`);
}

const worklistFamily = routeFiles.filter((file) => /worklist|workbasket|task|docket/i.test(file));
assert.ok(worklistFamily.length > 0, 'Expected worklist/workbasket-related route files to exist.');

for (const file of [...requiredExplicit, ...worklistFamily]) {
  const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
  if (!source.includes('express.Router(')) continue;
  assert.ok(source.includes('applyRouteValidation('), `${file} must use applyRouteValidation.`);
  assert.match(source, /require\(\s*['"]\.\.\/schemas\/.+\.routes\.schema(?:\.js)?['"]\s*\)/, `${file} must import an explicit route schema file.`);
}

console.log('pilotRouteSchemaAudit.test.js passed');
