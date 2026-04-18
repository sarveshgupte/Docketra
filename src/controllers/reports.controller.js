const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const Task = require('../models/Task');
const CaseAudit = require('../models/CaseAudit.model');
const AuthAudit = require('../models/AuthAudit.model');
const ReportExportLog = require('../models/ReportExportLog.model');
const { Parser } = require('json2csv');
const { generateCasesExcelWorkbook } = require('../services/excel.service');
const PDFDocument = require('pdfkit');
const { getLatestTenantMetrics, getTenantMetricsByRange } = require('../services/tenantCaseMetrics.service');
const { mapAuditResponse } = require('../mappers/audit.mapper');
const { getWeeklySlaSummary } = require('../services/sla.service');
const reportsService = require('../services/reports.service');
const log = require('../utils/log');

const DEFAULT_AUDIT_LOG_LIMIT = 100;
const MAX_AUDIT_LOG_LIMIT = 250;
const MAX_EXPORT_ROWS = 5000;
const MAX_REPORT_PAGE_LIMIT = 250;
const MAX_REPORT_RANGE_DAYS = 366;
const DEFAULT_EXPORT_HISTORY_LIMIT = 25;
const MAX_EXPORT_HISTORY_LIMIT = 200;

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const validateDateRangeWindow = (fromDate, toDate) => {
  if (!isValidDate(fromDate) || !isValidDate(toDate)) {
    return { valid: false, message: 'Invalid fromDate or toDate' };
  }

  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (start > end) {
    return { valid: false, message: 'fromDate must be before or equal to toDate' };
  }

  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days > MAX_REPORT_RANGE_DAYS) {
    // PERFORMANCE: Hard cap enforced to prevent memory exhaustion
    return { valid: false, message: `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days` };
  }

  return { valid: true, start, end };
};

const hydrateCasesForReport = async (firmId, cases) => {
  const clientIds = [...new Set(cases.map((item) => item.clientId).filter(Boolean))];
  const assignedToXids = [...new Set(cases.map((item) => item.assignedToXID).filter(Boolean))];

  // PERFORMANCE: Eliminated N+1 query pattern
  const [clients, users] = await Promise.all([
    Client.find({ firmId, clientId: { $in: clientIds } }).select('clientId businessName').lean(),
    User.find({ firmId, xID: { $in: assignedToXids } }).select('xID email').lean(),
  ]);

  const clientMap = new Map(clients.map((item) => [item.clientId, item]));
  const userMap = new Map(users.map((item) => [item.xID, item]));

  return cases.map((caseItem) => {
    const client = clientMap.get(caseItem.clientId);
    const assignedUser = caseItem.assignedToXID ? userMap.get(caseItem.assignedToXID) : null;

    return {
      caseId: caseItem.caseId,
      caseName: caseItem.caseName,
      title: caseItem.title,
      status: caseItem.status,
      category: caseItem.category,
      clientId: caseItem.clientId,
      clientName: client ? client.businessName : 'Unknown',
      assignedTo: assignedUser ? assignedUser.email : (caseItem.assignedToXID || ''),
      createdAt: caseItem.createdAt,
      createdBy: caseItem.createdBy,
      pendingUntil: caseItem.pendingUntil,
      ageingDays: caseItem.ageingDays,
      ageingBucket: caseItem.ageingBucket,
    };
  });
};

const resolveFirmIdFromAuthContext = (req, res) => {
  const firmId = req.user?.firmId || req.firmId;
  if (!firmId && req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, message: 'Forbidden: firm context required' });
    return null;
  }
  return firmId;
};

const logReportExport = async ({
  firmId,
  req,
  exportType,
  filename,
  filters,
  totalRecords,
}) => {
  const fallbackXid = req.user?.xID || req.user?.xid || 'UNKNOWN';
  try {
    await ReportExportLog.create({
      firmId,
      exportedByXID: String(fallbackXid),
      exportedByName: req.user?.name || null,
      exportedByEmail: req.user?.email || null,
      exportType,
      filename,
      filters,
      totalRecords,
      exportedAt: new Date(),
    });
  } catch (error) {
    log.error('Failed to persist report export log:', error);
  }
};


/**
 * Reports Controller for Docketra Case Management System
 * 
 * Provides read-only reporting and MIS functionality for admin users
 * All endpoints are strictly read-only - no data mutation allowed
 * 
 * Endpoints:
 * - getCaseMetrics: Aggregate case counts by status/category/client/employee
 * - getPendingCasesReport: Pending cases with ageing calculation
 * - getCasesByDateRange: Filtered case list with pagination
 * - exportCasesCSV: CSV export with filters
 * - exportCasesExcel: Excel export with filters
 */

/**
 * GET /api/reports/case-metrics
 * 
 * Aggregate case metrics by status, category, client, and employee
 * Supports filtering by date range, status, category, clientId, assignedTo
 */
const getCaseMetrics = async (req, res) => {
  try {
    const tenantId = resolveFirmIdFromAuthContext(req, res);
    if (!tenantId) return;
    const { fromDate, toDate, allowLongRange } = req.query;

    let payload;

    if (fromDate || toDate) {
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: 'Both fromDate and toDate are required for range reporting',
        });
      }

      const rangeData = await getTenantMetricsByRange(
        tenantId,
        fromDate,
        toDate,
        { allowLongRange: String(allowLongRange).toLowerCase() === 'true' }
      );

      payload = {
        totalCases: rangeData.aggregate.totalCases,
        byStatus: {
          OPEN: rangeData.aggregate.openCases,
          PENDING: rangeData.aggregate.pendedCases,
          FILED: rangeData.aggregate.filedCases,
          RESOLVED: rangeData.aggregate.resolvedCases,
        },
        overdueCases: rangeData.aggregate.overdueCases,
        avgResolutionTimeSeconds: rangeData.aggregate.avgResolutionTimeSeconds,
        casesCreatedToday: rangeData.aggregate.casesCreatedToday,
        casesResolvedToday: rangeData.aggregate.casesResolvedToday,
        pendingApprovals: rangeData.aggregate.pendingApprovals,
        range: rangeData.range,
        rowsCount: rangeData.rowsCount,
        byCategory: {},
        byClient: [],
        byEmployee: [],
        profitability: {
          totalEstimatedBudget: 0,
          totalActualCost: 0,
          variance: 0,
        },
      };
    } else {
      const latest = await getLatestTenantMetrics(tenantId);
      payload = {
        totalCases: latest?.totalCases || 0,
        byStatus: {
          OPEN: latest?.openCases || 0,
          PENDING: latest?.pendedCases || 0,
          FILED: latest?.filedCases || 0,
          RESOLVED: latest?.resolvedCases || 0,
        },
        overdueCases: latest?.overdueCases || 0,
        avgResolutionTimeSeconds: latest?.avgResolutionTimeSeconds || 0,
        casesCreatedToday: latest?.casesCreatedToday || 0,
        casesResolvedToday: latest?.casesResolvedToday || 0,
        pendingApprovals: latest?.pendingApprovals || 0,
        metricsDate: latest?.date || null,
        byCategory: {},
        byClient: [],
        byEmployee: [],
        profitability: {
          totalEstimatedBudget: 0,
          totalActualCost: 0,
          variance: 0,
        },
      };
    }

    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    log.error('Error in getCaseMetrics:', error);
    if (error.message?.includes('Date range exceeds')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch case metrics',
      error: error.message,
    });
  }
};


const getSlaWeeklySummary = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;

    const data = await getWeeklySlaSummary(firmId);
    return res.json({ success: true, data });
  } catch (error) {
    log.error('Error in getSlaWeeklySummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly SLA summary',
      error: error.message,
    });
  }
};

const calculateAgeingForCases = (cases) => {
  const today = new Date();
  return cases.map(caseItem => {
    const pendingDate = new Date(caseItem.pendingUntil);
    const ageingDays = Math.floor((today - pendingDate) / (1000 * 60 * 60 * 24));

    let ageingBucketValue;
    if (ageingDays <= 7) {
      ageingBucketValue = '0-7 days';
    } else if (ageingDays <= 30) {
      ageingBucketValue = '8-30 days';
    } else {
      ageingBucketValue = '30+ days';
    }

    return {
      ...caseItem,
      ageingDays,
      ageingBucket: ageingBucketValue,
    };
  });
};

const aggregateByCategory = (cases) => {
  const byCategoryMap = {};
  cases.forEach(c => {
    byCategoryMap[c.category] = (byCategoryMap[c.category] || 0) + 1;
  });
  return byCategoryMap;
};

const aggregateByEmployee = async (firmId, cases) => {
  const byEmployeeMap = {};
  cases.forEach(c => {
    if (c.assignedTo) {
      byEmployeeMap[c.assignedTo] = (byEmployeeMap[c.assignedTo] || 0) + 1;
    }
  });

  const employeeLookupValues = Object.keys(byEmployeeMap);
  const normalizedEmails = employeeLookupValues.map((value) => String(value).trim().toLowerCase());
  // PERFORMANCE: Eliminated N+1 query pattern
  const [employeeUsersByXid, employeeUsersByEmail] = await Promise.all([
    User.find({
      firmId,
      xID: { $in: employeeLookupValues },
      status: { $ne: 'deleted' },
    }).select('xID email name').lean(),
    User.find({
      firmId,
      email: { $in: normalizedEmails },
      status: { $ne: 'deleted' },
    }).select('xID email name').lean(),
  ]);
  const byXidMap = new Map(employeeUsersByXid.map((user) => [user.xID, user]));
  const byEmailMap = new Map(employeeUsersByEmail.map((user) => [String(user.email).trim().toLowerCase(), user]));

  const byEmployee = [];
  for (const assignedToValue of employeeLookupValues) {
    const user = byXidMap.get(assignedToValue) || byEmailMap.get(String(assignedToValue).trim().toLowerCase());
    byEmployee.push({
      xID: user ? user.xID : assignedToValue,
      email: user ? user.email : 'Unknown',
      name: user ? user.name : 'Unknown',
      count: byEmployeeMap[assignedToValue],
    });
  }
  byEmployee.sort((a, b) => b.count - a.count);
  return byEmployee;
};

const aggregateByAgeing = (cases) => {
  return {
    '0-7 days': cases.filter(c => c.ageingBucket === '0-7 days').length,
    '8-30 days': cases.filter(c => c.ageingBucket === '8-30 days').length,
    '30+ days': cases.filter(c => c.ageingBucket === '30+ days').length,
  };
};

/**
 * GET /api/reports/pending-cases
 * 
 * Report on pending cases with ageing calculation
 * Supports filtering by category, assignedTo, ageingBucket
 */
const getPendingCasesReport = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;
    const { category, assignedTo, ageingBucket } = req.query;
    
    // Build match stage for pending cases
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    // Support legacy records that still use "Pending" while the canonical backend enum is "PENDING".
    const matchStage = { firmId, status: { $in: ['Pending', 'PENDING'] } };
    
    if (category) matchStage.category = category;
    if (assignedTo) matchStage.assignedToXID = assignedTo; // Use assignedToXID for canonical queries
    
    // Fetch all pending cases
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const cases = await Case.find(matchStage).limit(MAX_EXPORT_ROWS + 1).lean();
    if (cases.length > MAX_EXPORT_ROWS) {
      // PERFORMANCE: Hard cap enforced to prevent memory exhaustion
      return res.status(400).json({
        success: false,
        message: `Pending cases report exceeds ${MAX_EXPORT_ROWS} rows. Narrow your filters.`,
      });
    }

    // Calculate ageing for each case
    const casesWithAgeing = calculateAgeingForCases(cases);
    
    // Filter by ageing bucket if specified
    let filteredCases = casesWithAgeing;
    if (ageingBucket) {
      filteredCases = casesWithAgeing.filter(c => c.ageingBucket === ageingBucket);
    }
    
    const casesWithClientNames = await hydrateCasesForReport(firmId, filteredCases);
    
    // Sort by ageing descending (oldest first)
    casesWithClientNames.sort((a, b) => b.ageingDays - a.ageingDays);
    
    // Aggregate by category
    const byCategoryMap = aggregateByCategory(filteredCases);
    
    // Aggregate by employee
    const byEmployee = await aggregateByEmployee(firmId, filteredCases);
    
    // Aggregate by ageing
    const byAgeing = aggregateByAgeing(filteredCases);
    
    res.json({
      success: true,
      data: {
        totalPending: filteredCases.length,
        byCategory: byCategoryMap,
        byEmployee,
        byAgeing,
        cases: casesWithClientNames,
      },
    });
  } catch (error) {
    log.error('Error in getPendingCasesReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending cases report',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/cases-by-date
 * 
 * Get cases within a date range with filtering and pagination
 */
const getCasesByDateRange = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;
    const { fromDate, toDate, status, category, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(limitNum) || limitNum < 1 || limitNum > MAX_REPORT_PAGE_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `page must be >= 1 and limit must be between 1 and ${MAX_REPORT_PAGE_LIMIT}`,
      });
    }

    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    const rangeValidation = validateDateRangeWindow(fromDate, toDate);
    if (!rangeValidation.valid) {
      return res.status(400).json({ success: false, message: rangeValidation.message });
    }

    // Build match stage
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const matchStage = {
      firmId,
      createdAt: {
        $gte: rangeValidation.start,
        $lte: rangeValidation.end,
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    const skip = (pageNum - 1) * limitNum;

    // PERFORMANCE: Execute independent queries concurrently
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const [total, cases] = await Promise.all([
      Case.countDocuments(matchStage),
      Case.find(matchStage)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);
    
    const casesWithClientNames = await hydrateCasesForReport(firmId, cases);
    
    res.json({
      success: true,
      data: {
        cases: casesWithClientNames,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    log.error('Error in getCasesByDateRange:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cases by date range',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/export/csv
 * 
 * Export cases as CSV with filters
 */
const exportCasesCSV = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;
    const { fromDate, toDate, status, category } = req.query;
    
    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    const rangeValidation = validateDateRangeWindow(fromDate, toDate);
    if (!rangeValidation.valid) {
      return res.status(400).json({ success: false, message: rangeValidation.message });
    }

    // Build match stage
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const matchStage = {
      firmId,
      createdAt: {
        $gte: rangeValidation.start,
        $lte: rangeValidation.end,
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    // ⚡ Bolt Performance Optimization:
    // Replaced sequential countDocuments() and find() queries with a single find() using limit(MAX_EXPORT_ROWS + 1).
    // Impact: Eliminates an entire database count operation, reducing latency and DB load.
    // Expected improvement: 50% reduction in database queries for this endpoint.

    // Get all matching cases (bounded for export)
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const cases = await Case.find(matchStage)
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    if (cases.length > MAX_EXPORT_ROWS) {
      // PERFORMANCE: Hard cap enforced to prevent memory exhaustion
      return res.status(400).json({
        success: false,
        message: `Export exceeds maximum row limit of ${MAX_EXPORT_ROWS}. Narrow your filters.`,
      });
    }
    
    const hydratedCases = await hydrateCasesForReport(firmId, cases);
    const casesWithClientNames = hydratedCases.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
    
    // Convert to CSV
    const fields = ['caseId', 'caseName', 'title', 'status', 'category', 'clientId', 'clientName', 'assignedTo', 'createdAt', 'createdBy'];
    const parser = new Parser({ fields });
    const csv = parser.parse(casesWithClientNames);
    
    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `docketra-report-${dateStr}.csv`;
    
    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await logReportExport({
      firmId,
      req,
      exportType: 'csv',
      filename,
      filters: { fromDate, toDate, status: status || null, category: category || null },
      totalRecords: casesWithClientNames.length,
    });

    res.send(csv);
  } catch (error) {
    log.error('Error in exportCasesCSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export cases as CSV',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/export/excel
 * 
 * Export cases as Excel with filters
 */
const exportCasesExcel = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;
    const { fromDate, toDate, status, category } = req.query;
    
    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    const rangeValidation = validateDateRangeWindow(fromDate, toDate);
    if (!rangeValidation.valid) {
      return res.status(400).json({ success: false, message: rangeValidation.message });
    }

    // Build match stage
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const matchStage = {
      firmId,
      createdAt: {
        $gte: rangeValidation.start,
        $lte: rangeValidation.end,
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    // ⚡ Bolt Performance Optimization:
    // Replaced sequential countDocuments() and find() queries with a single find() using limit(MAX_EXPORT_ROWS + 1).
    // Impact: Eliminates an entire database count operation, reducing latency and DB load.
    // Expected improvement: 50% reduction in database queries for this endpoint.

    // Get all matching cases (bounded for export)
    const cases = await Case.find(matchStage)
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();

    if (cases.length > MAX_EXPORT_ROWS) {
      // PERFORMANCE: Hard cap enforced to prevent memory exhaustion
      return res.status(400).json({
        success: false,
        message: `Export exceeds maximum row limit of ${MAX_EXPORT_ROWS}. Narrow your filters.`,
      });
    }
    
    const casesWithClientNames = await hydrateCasesForReport(firmId, cases);
    
    // Create Excel workbook using the service
    const workbook = generateCasesExcelWorkbook(casesWithClientNames);
    
    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `docketra-report-${dateStr}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await logReportExport({
      firmId,
      req,
      exportType: 'excel',
      filename,
      filters: { fromDate, toDate, status: status || null, category: category || null },
      totalRecords: casesWithClientNames.length,
    });

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    log.error('Error in exportCasesExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export cases as Excel',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/audit-logs
 * Unified audit feed from CaseAudit + AuthAudit with filters
 */
const getAuditLogs = async (req, res) => {
  try {
    const { xID, action, timestamp, limit = DEFAULT_AUDIT_LOG_LIMIT } = req.query;
    const parsedLimit = parseInt(limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ success: false, message: 'limit must be a positive integer' });
    }
    if (parsedLimit > MAX_AUDIT_LOG_LIMIT) {
      // PERFORMANCE: Hard cap enforced to prevent memory exhaustion
      return res.status(400).json({
        success: false,
        message: `limit cannot exceed ${MAX_AUDIT_LOG_LIMIT}`,
      });
    }
    const cappedLimit = parsedLimit;
    const since = timestamp ? new Date(timestamp) : null;

    const resolvedFirmId = resolveFirmIdFromAuthContext(req, res);
    if (!resolvedFirmId) return;
    const firmId = String(resolvedFirmId);
    if (timestamp && Number.isNaN(since.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid timestamp filter' });
    }
    // PERFORMANCE: Optimized audit query to avoid large $in arrays
    const caseAuditFilter = { firmId };
    if (xID) caseAuditFilter.performedByXID = xID;
    if (action) caseAuditFilter.actionType = action;
    if (since) caseAuditFilter.timestamp = { $gte: since };

    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const authAuditFilter = { firmId };
    if (xID) authAuditFilter.xID = xID;
    if (action) authAuditFilter.actionType = action;
    if (since) authAuditFilter.timestamp = { $gte: since };

    // PERFORMANCE: Optimized audit query to avoid large $in arrays
    const directCaseLogs = await CaseAudit.find(caseAuditFilter)
      .sort({ timestamp: -1 })
      .limit(cappedLimit)
      .lean();

    let caseLogs = directCaseLogs;
    if (caseLogs.length < cappedLimit) {
      const legacyCaseAuditPipeline = [
        { $match: { firmId: { $exists: false } } },
        ...(xID ? [{ $match: { performedByXID: xID } }] : []),
        ...(action ? [{ $match: { actionType: action } }] : []),
        ...(since ? [{ $match: { timestamp: { $gte: since } } }] : []),
        {
          $lookup: {
            from: 'cases',
            let: { auditCaseId: '$caseId' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$caseId', '$$auditCaseId'] }, { $eq: ['$firmId', firmId] }] } } },
              { $project: { _id: 1 } },
            ],
            as: 'tenantCase',
          },
        },
        { $match: { tenantCase: { $ne: [] } } },
        { $sort: { timestamp: -1 } },
        { $limit: cappedLimit - caseLogs.length },
      ];

      const legacyCaseLogs = await CaseAudit.aggregate(legacyCaseAuditPipeline);
      caseLogs = [...caseLogs, ...legacyCaseLogs];
    }

    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const authLogs = await AuthAudit.find(authAuditFilter).sort({ timestamp: -1 }).limit(cappedLimit).lean();

    const combined = [
      ...caseLogs.map((item) => mapAuditResponse({
        ...item,
        xID: item.performedByXID,
        action: item.actionType,
      }, 'CaseAudit')),
      ...authLogs.map((item) => mapAuditResponse({
        ...item,
        action: item.actionType,
      }, 'AuthAudit')),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, cappedLimit);

    return res.json({ success: true, data: combined, count: combined.length });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
};

const getExportHistory = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;

    const {
      exportType,
      exportedByXID,
      page = 1,
      limit = DEFAULT_EXPORT_HISTORY_LIMIT,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (!Number.isInteger(pageNum) || pageNum < 1 || !Number.isInteger(limitNum) || limitNum < 1) {
      return res.status(400).json({ success: false, message: 'page and limit must be positive integers' });
    }
    if (limitNum > MAX_EXPORT_HISTORY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `limit cannot exceed ${MAX_EXPORT_HISTORY_LIMIT}`,
      });
    }

    const query = { firmId };
    if (exportType && ['csv', 'excel'].includes(String(exportType).toLowerCase())) {
      query.exportType = String(exportType).toLowerCase();
    }
    if (exportedByXID) {
      query.exportedByXID = String(exportedByXID);
    }

    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
      ReportExportLog.find(query).sort({ exportedAt: -1 }).skip(skip).limit(limitNum).lean(),
      ReportExportLog.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/client-fact-sheet/:clientId/pdf
 * Generate PDF client fact sheet with active cases and pending tasks
 */
const generateClientFactSheetPdf = async (req, res) => {
  try {
    const firmId = resolveFirmIdFromAuthContext(req, res);
    if (!firmId) return;
    const { clientId } = req.params;
    if (!/^[A-Za-z0-9_-]+$/.test(String(clientId || ''))) {
      return res.status(400).json({ success: false, message: 'Invalid clientId format' });
    }
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const client = await Client.findOne({ clientId, firmId }).lean();

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const activeCases = await Case.find({
      firmId,
      clientId,
      status: { $in: ['UNASSIGNED', 'OPEN', 'PENDING', 'UNDER_REVIEW', 'SUBMITTED', 'APPROVED'] },
    })
      .select('caseId caseNumber title status')
      .lean();

    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const clientCaseIds = await Case.find({ firmId, clientId }).distinct('_id');
    // SECURITY: Enforcing tenant isolation (firm-scoped query)
    const pendingTasks = await Task.find({
      firmId,
      case: { $in: clientCaseIds },
      status: { $in: ['pending', 'in_progress', 'review', 'blocked'] },
    })
      .populate('case', 'caseId caseNumber')
      .lean();

    const doc = new PDFDocument({ margin: 50 });
    const safeClientId = String(clientId).replace(/[^a-zA-Z0-9_-]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="client-fact-sheet-${safeClientId}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('Docketra Client Fact Sheet', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Client ID: ${client.clientId}`);
    doc.text(`Business Name: ${client.businessName || '-'}`);
    doc.text(`Primary Contact: ${client.primaryContactNumber || '-'}`);
    doc.text(`Business Email: ${client.businessEmail || '-'}`);
    doc.moveDown();
    doc.fontSize(14).text('Active Cases');
    if (!activeCases.length) {
      doc.fontSize(11).text('No active cases.');
    } else {
      activeCases.forEach((item) => {
        doc.fontSize(11).text(`• ${item.caseNumber || item.caseId} — ${item.title} [${item.status}]`);
      });
    }
    doc.moveDown();
    doc.fontSize(14).text('Pending Tasks');
    if (!pendingTasks.length) {
      doc.fontSize(11).text('No pending tasks.');
    } else {
      pendingTasks.forEach((task) => {
        doc.fontSize(11).text(`• ${task.title} (${task.status})`);
      });
    }
    doc.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate client fact sheet',
      error: error.message,
    });
  }
};


const buildReportsFilter = (req) => ({
  firmId: req.firmId || req.user?.firmId,
  fromDate: req.query?.fromDate,
  toDate: req.query?.toDate,
  userId: req.query?.userId,
  clientId: req.query?.clientId,
  isInternal: req.query?.isInternal,
  limit: req.query?.limit,
  sortBy: req.query?.sortBy,
  order: req.query?.order,
});

const validateReportsFirmScope = (res, filter) => {
  if (!filter.firmId) {
    res.status(400).json({ error: 'Missing firmId' });
    return false;
  }

  return true;
};

const userProductivity = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getUserProductivity(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user productivity', error: error.message });
  }
};

const docketStats = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getDocketStats(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch docket stats', error: error.message });
  }
};

const qcPerformance = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getQCPerformance(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch QC performance', error: error.message });
  }
};

const timePerUser = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getTimePerUser(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user time analytics', error: error.message });
  }
};

const clientWorkload = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getClientWorkload(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch client workload', error: error.message });
  }
};

const docketTimeStats = async (req, res) => {
  try {
    const filter = buildReportsFilter(req);
    if (!validateReportsFirmScope(res, filter)) return;
    const data = await reportsService.getDocketTimeStats(filter);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch docket time analytics', error: error.message });
  }
};

module.exports = {
  getCaseMetrics,
  getPendingCasesReport,
  getSlaWeeklySummary,
  getCasesByDateRange,
  exportCasesCSV,
  exportCasesExcel,
  getAuditLogs,
  getExportHistory,
  generateClientFactSheetPdf,
  userProductivity,
  docketStats,
  qcPerformance,
  timePerUser,
  clientWorkload,
  docketTimeStats,
};
