#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const caseApi = read('ui/src/api/case.api.js');
const worklistApi = read('ui/src/api/worklist.api.js');
const clientApi = read('ui/src/api/client.api.js');
const notificationApi = read('ui/src/api/notifications.api.js');
const adminApi = read('ui/src/api/admin.api.js');

const tenantMounts = read('src/app/routes/mountTenantRoutes.js');
const appMounts = read('src/app/createApp.js');
const platformMounts = read('src/app/routes/mountPlatformRoutes.js');

const expectations = [
  { frontend: caseApi, routeRef: '/cases', backendMount: "app.use('/api/cases'", note: 'dockets/cases compatibility' },
  { frontend: caseApi, routeRef: '/dockets', backendMount: "app.use('/api/dockets'", note: 'dockets namespace compatibility' },
  { frontend: worklistApi, routeRef: '/worklists', backendMount: "app.use('/api/worklists'", note: 'worklists' },
  { frontend: clientApi, routeRef: '/clients', backendMount: "app.use('/api/clients'", note: 'clients' },
  { frontend: notificationApi, routeRef: '/notifications', backendMount: "app.use('/api/notifications'", note: 'notifications' },
  { frontend: adminApi, routeRef: '/admin/workbaskets', backendMount: "app.use('/api/admin'", note: 'teams/work settings via admin APIs' },
  { frontend: adminApi, routeRef: '/admin/work-settings', backendMount: "app.use('/api/admin'", note: 'work settings operations' },
];

for (const { frontend, routeRef, backendMount, note } of expectations) {
  assert.ok(frontend.includes(routeRef), `Frontend pilot API usage should include ${note}: ${routeRef}`);
  assert.ok(tenantMounts.includes(backendMount) || appMounts.includes(backendMount) || platformMounts.includes(backendMount), `Backend route mount should include ${note}: ${backendMount}`);
}

console.log('pilotLaunchReadinessApiParity.test.js passed');
