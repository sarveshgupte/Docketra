const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/reports.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { requireStorageConnected } = require('../middleware/requireStorageConnected');
const {
  getCaseMetrics,
  getPendingCasesReport,
  getSlaWeeklySummary,
  getCasesByDateRange,
  exportCasesCSV,
  exportCasesExcel,
  getAuditLogs,
  getExportHistory,
  generateClientFactSheetPdf,
} = require('../controllers/reports.controller');

/**
 * Reports Routes for Docketra Case Management System
 * 
 * All report routes require authentication and admin role
 * Reports are strictly read-only - no data mutation allowed
 * SuperAdmin is blocked from accessing firm-specific reports
 * Rate limited to prevent report generation abuse
 */

// Auth + tenant context are provided by app-level tenantScopedApiAccess in server.js
router.use(authorizeFirmPermission('REPORT_VIEW'));
router.use(userReadLimiter);

// Case metrics aggregation
router.get('/case-metrics', getCaseMetrics);

// Pending cases report with ageing
router.get('/pending-cases', getPendingCasesReport);
router.get('/sla-weekly-summary', getSlaWeeklySummary);

// Cases by date range with pagination
router.get('/cases-by-date', getCasesByDateRange);

// Export routes
router.get('/export/csv', requireStorageConnected, exportCasesCSV);
router.get('/export/excel', requireStorageConnected, exportCasesExcel);
router.get('/export-history', getExportHistory);
router.get('/audit-logs', getAuditLogs);
router.get('/client-fact-sheet/:clientId/pdf', generateClientFactSheetPdf);

module.exports = router;
