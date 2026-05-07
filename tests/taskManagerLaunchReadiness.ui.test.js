#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const navSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/constants/platformNavigation.js'), 'utf8');
const routesSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');

function run() {
  assert.ok(navSource.includes("label: 'Work'"), 'Task Manager/Work must remain primary navigation item');
  assert.ok(!navSource.includes("label: 'CRM'"), 'CRM must not appear in primary navigation blueprint for launch mode');
  assert.ok(!navSource.includes("label: 'CMS'"), 'CMS must not appear in primary navigation blueprint for launch mode');
  assert.ok(!navSource.includes("label: 'Company Brain'"), 'Company Brain must not appear in primary navigation blueprint for launch mode');
  assert.ok(!navSource.includes("label: 'Knowledge Library'"), 'Knowledge Library must not appear in primary navigation blueprint for launch mode');

  assert.ok(routesSource.includes('path="storage-settings"'), 'Storage settings route must exist');
  assert.ok(routesSource.includes('requireAdmin'), 'Storage settings route must remain admin-protected');

  assert.ok(routesSource.includes('path="crm"'), 'CRM route should remain available outside primary nav for backward compatibility');
  assert.ok(routesSource.includes('path="cms"'), 'CMS route should remain available outside primary nav for backward compatibility');

  console.log('✓ task manager launch-mode navigation and route guardrails hold');
}

run();
