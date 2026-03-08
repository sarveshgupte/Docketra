#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const dashboardSource = fs.readFileSync(
  require.resolve('../ui/src/pages/DashboardPage.jsx'),
  'utf8'
);

assert.ok(
  dashboardSource.includes('const loadStatsPatch = async (request, mapResponse, errorMessage, warningMessage) => {'),
  'dashboard loader should centralize per-request warning-preserving stat patch handling'
);

assert.ok(
  dashboardSource.includes('] = await Promise.all(['),
  'dashboard loader should fetch independent dashboard requests concurrently with Promise.all'
);

assert.ok(
  dashboardSource.includes('recentCasesPromise,'),
  'dashboard loader should include recent cases in the concurrent request batch'
);

assert.ok(
  dashboardSource.includes("() => metricsService.getFirmMetrics(userFirmId)"),
  'dashboard loader should continue loading firm metrics'
);

assert.ok(
  dashboardSource.includes("() => worklistService.getEmployeeWorklist()"),
  'dashboard loader should continue loading open case counts'
);

assert.ok(
  dashboardSource.includes("() => api.get('/cases/my-pending')"),
  'dashboard loader should continue loading pending case counts'
);

assert.ok(
  dashboardSource.includes("() => caseService.getMyResolvedCases()"),
  'dashboard loader should continue loading resolved case counts'
);

assert.ok(
  dashboardSource.includes("() => adminService.getPendingApprovals()"),
  'dashboard loader should continue loading admin approval counts'
);

assert.ok(
  dashboardSource.includes("() => clientService.getClients(true)"),
  'dashboard loader should continue loading client counts'
);

assert.ok(
  dashboardSource.includes('setRecentCases(getRecentCasesSnapshot(casesToDisplay));'),
  'dashboard loader should still update recent cases from the loaded data'
);

assert.ok(
  dashboardSource.includes("'Recent cases'") &&
    dashboardSource.includes("'Firm metrics'") &&
    dashboardSource.includes("'Client counts'"),
  'dashboard loader should preserve partial-load warning reporting'
);

console.log('Dashboard page load concurrency guardrails passed.');
