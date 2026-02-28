const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const Task = require('../models/Task');
const CaseAudit = require('../models/CaseAudit.model');
const AuthAudit = require('../models/AuthAudit.model');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const DEFAULT_AUDIT_LOG_LIMIT = 100;
const MAX_AUDIT_LOG_LIMIT = 250;

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
    const { fromDate, toDate, status, category, clientId, assignedTo } = req.query;
    
    // Build match stage for filtering
    const matchStage = {};
    
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
      if (toDate) matchStage.createdAt.$lte = new Date(toDate);
    }
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    if (clientId) matchStage.clientId = clientId;
    if (assignedTo) matchStage.assignedToXID = assignedTo; // Use assignedToXID for canonical queries
    
    // Get total count
    const totalCases = await Case.countDocuments(matchStage);
    
    // Aggregate by status
    const byStatusResult = await Case.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    
    const byStatus = {};
    byStatusResult.forEach(item => {
      byStatus[item._id] = item.count;
    });
    
    // Aggregate by category
    const byCategoryResult = await Case.aggregate([
      { $match: matchStage },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    const byCategory = {};
    byCategoryResult.forEach(item => {
      byCategory[item._id] = item.count;
    });
    
    // Aggregate by client
    const byClientResult = await Case.aggregate([
      { $match: matchStage },
      { $group: { _id: '$clientId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // Populate client names
    const byClient = [];
    for (const item of byClientResult) {
      const client = await Client.findOne({ clientId: item._id }).lean();
      byClient.push({
        clientId: item._id,
        clientName: client ? client.businessName : 'Unknown',
        count: item.count,
      });
    }
    
    // Aggregate by employee
    // PR: xID Canonicalization - Use assignedToXID for queries
    const byEmployeeResult = await Case.aggregate([
      { $match: { ...matchStage, assignedToXID: { $ne: null, $ne: '' } } },
      { $group: { _id: '$assignedToXID', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // Populate employee names
    // assignedToXID contains xID, resolve to user for display
    const byEmployee = [];
    for (const item of byEmployeeResult) {
      const user = await User.findOne({ xID: item._id }).lean();
      byEmployee.push({
        xID: item._id,
        email: user ? user.email : 'Unknown',
        name: user ? user.name : 'Unknown',
        count: item.count,
      });
    }

    // Profitability variance across active cases
    const profitability = await Case.aggregate([
      {
        $match: {
          ...matchStage,
          status: { $in: ['UNASSIGNED', 'OPEN', 'PENDED', 'UNDER_REVIEW', 'SUBMITTED', 'APPROVED'] },
        },
      },
      {
        $group: {
          _id: null,
          totalEstimatedBudget: { $sum: { $ifNull: ['$estimatedBudget', 0] } },
          totalActualCost: { $sum: { $ifNull: ['$actualCost', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalEstimatedBudget: 1,
          totalActualCost: 1,
          variance: { $subtract: ['$totalEstimatedBudget', '$totalActualCost'] },
        },
      },
    ]);
    
    res.json({
      success: true,
      data: {
        totalCases,
        byStatus,
        byCategory,
        byClient,
        byEmployee,
        profitability: profitability[0] || {
          totalEstimatedBudget: 0,
          totalActualCost: 0,
          variance: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error in getCaseMetrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch case metrics',
      error: error.message,
    });
  }
};

/**
 * GET /api/reports/pending-cases
 * 
 * Report on pending cases with ageing calculation
 * Supports filtering by category, assignedTo, ageingBucket
 */
const getPendingCasesReport = async (req, res) => {
  try {
    const { category, assignedTo, ageingBucket } = req.query;
    
    // Build match stage for pending cases
    const matchStage = { status: 'Pending' };
    
    if (category) matchStage.category = category;
    if (assignedTo) matchStage.assignedToXID = assignedTo; // Use assignedToXID for canonical queries
    
    // Fetch all pending cases
    const cases = await Case.find(matchStage).lean();
    
    // Calculate ageing for each case
    const today = new Date();
    const casesWithAgeing = cases.map(caseItem => {
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
    
    // Filter by ageing bucket if specified
    let filteredCases = casesWithAgeing;
    if (ageingBucket) {
      filteredCases = casesWithAgeing.filter(c => c.ageingBucket === ageingBucket);
    }
    
    // Populate client names and resolve assignedTo xID to user info
    const casesWithClientNames = [];
    for (const caseItem of filteredCases) {
      const client = await Client.findOne({ clientId: caseItem.clientId }).lean();
      
      // PR: xID Canonicalization - Resolve assignedToXID to user info for display
      let assignedToDisplay = caseItem.assignedToXID || '';
      if (caseItem.assignedToXID) {
        const assignedUser = await User.findOne({ xID: caseItem.assignedToXID }).lean();
        assignedToDisplay = assignedUser ? assignedUser.email : caseItem.assignedToXID;
      }
      
      casesWithClientNames.push({
        caseId: caseItem.caseId,
        caseName: caseItem.caseName,
        title: caseItem.title,
        category: caseItem.category,
        clientId: caseItem.clientId,
        clientName: client ? client.businessName : 'Unknown',
        assignedTo: assignedToDisplay, // Display email, not xID
        pendingUntil: caseItem.pendingUntil,
        ageingDays: caseItem.ageingDays,
        ageingBucket: caseItem.ageingBucket,
      });
    }
    
    // Sort by ageing descending (oldest first)
    casesWithClientNames.sort((a, b) => b.ageingDays - a.ageingDays);
    
    // Aggregate by category
    const byCategoryMap = {};
    filteredCases.forEach(c => {
      byCategoryMap[c.category] = (byCategoryMap[c.category] || 0) + 1;
    });
    
    // Aggregate by employee
    // PR #42: assignedTo now stores xID, need to resolve to user info
    const byEmployeeMap = {};
    filteredCases.forEach(c => {
      if (c.assignedTo) {
        byEmployeeMap[c.assignedTo] = (byEmployeeMap[c.assignedTo] || 0) + 1;
      }
    });
    
    const byEmployee = [];
    for (const assignedToValue of Object.keys(byEmployeeMap)) {
      // Try to find user by xID first, fallback to email for backward compatibility
      let user = await User.findOne({
        firmId: req.user?.firmId,
        xID: assignedToValue,
        status: { $ne: 'DELETED' },
      }).lean();
      if (!user) {
        user = await User.findOne({
          firmId: req.user?.firmId,
          email: String(assignedToValue).trim().toLowerCase(),
          status: { $ne: 'DELETED' },
        }).lean();
      }
      byEmployee.push({
        xID: user ? user.xID : assignedToValue,
        email: user ? user.email : 'Unknown',
        name: user ? user.name : 'Unknown',
        count: byEmployeeMap[assignedToValue],
      });
    }
    byEmployee.sort((a, b) => b.count - a.count);
    
    // Aggregate by ageing
    const byAgeing = {
      '0-7 days': filteredCases.filter(c => c.ageingBucket === '0-7 days').length,
      '8-30 days': filteredCases.filter(c => c.ageingBucket === '8-30 days').length,
      '30+ days': filteredCases.filter(c => c.ageingBucket === '30+ days').length,
    };
    
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
    console.error('Error in getPendingCasesReport:', error);
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
    const { fromDate, toDate, status, category, page = 1, limit = 50 } = req.query;
    
    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    // Build match stage
    const matchStage = {
      createdAt: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    // Get total count
    const total = await Case.countDocuments(matchStage);
    
    // Get paginated cases
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cases = await Case.find(matchStage)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Populate client names and resolve assignedTo xID to user info
    const casesWithClientNames = [];
    for (const caseItem of cases) {
      const client = await Client.findOne({ clientId: caseItem.clientId }).lean();
      
      // PR #42: Resolve assignedTo xID to user info for display
      let assignedToDisplay = caseItem.assignedToXID || '';
      if (caseItem.assignedToXID) {
        // Try to find user by xID first, fallback to email for backward compatibility
        let assignedUser = await User.findOne({ xID: caseItem.assignedToXID }).lean();
        assignedToDisplay = assignedUser ? assignedUser.email : caseItem.assignedToXID;
      }
      
      casesWithClientNames.push({
        caseId: caseItem.caseId,
        caseName: caseItem.caseName,
        title: caseItem.title,
        status: caseItem.status,
        category: caseItem.category,
        clientId: caseItem.clientId,
        clientName: client ? client.businessName : 'Unknown',
        assignedTo: assignedToDisplay, // Display email, not xID
        createdAt: caseItem.createdAt,
        createdBy: caseItem.createdBy,
      });
    }
    
    res.json({
      success: true,
      data: {
        cases: casesWithClientNames,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error in getCasesByDateRange:', error);
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
    const { fromDate, toDate, status, category } = req.query;
    
    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    // Build match stage
    const matchStage = {
      createdAt: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    // Get all matching cases (no pagination for export)
    const cases = await Case.find(matchStage)
      .sort({ createdAt: -1 })
      .lean();
    
    // Populate client names and resolve assignedTo xID to user info
    const casesWithClientNames = [];
    for (const caseItem of cases) {
      const client = await Client.findOne({ clientId: caseItem.clientId }).lean();
      
      // PR #42: Resolve assignedTo xID to user info for display
      let assignedToDisplay = caseItem.assignedToXID || '';
      if (caseItem.assignedToXID) {
        // Try to find user by xID first, fallback to email for backward compatibility
        let assignedUser = await User.findOne({ xID: caseItem.assignedToXID }).lean();
        assignedToDisplay = assignedUser ? assignedUser.email : caseItem.assignedToXID;
      }
      
      casesWithClientNames.push({
        caseId: caseItem.caseId,
        caseName: caseItem.caseName,
        title: caseItem.title,
        status: caseItem.status,
        category: caseItem.category,
        clientId: caseItem.clientId,
        clientName: client ? client.businessName : 'Unknown',
        assignedTo: assignedToDisplay, // Display email, not xID
        createdAt: caseItem.createdAt.toISOString(),
        createdBy: caseItem.createdBy,
      });
    }
    
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
    
    res.send(csv);
  } catch (error) {
    console.error('Error in exportCasesCSV:', error);
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
    const { fromDate, toDate, status, category } = req.query;
    
    // Validate required parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
      });
    }
    
    // Build match stage
    const matchStage = {
      createdAt: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      },
    };
    
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    
    // Get all matching cases (no pagination for export)
    const cases = await Case.find(matchStage)
      .sort({ createdAt: -1 })
      .lean();
    
    // Populate client names and resolve assignedTo xID to user info
    const casesWithClientNames = [];
    for (const caseItem of cases) {
      const client = await Client.findOne({ clientId: caseItem.clientId }).lean();
      
      // PR #42: Resolve assignedTo xID to user info for display
      let assignedToDisplay = caseItem.assignedToXID || '';
      if (caseItem.assignedToXID) {
        // Try to find user by xID first, fallback to email for backward compatibility
        let assignedUser = await User.findOne({ xID: caseItem.assignedToXID }).lean();
        assignedToDisplay = assignedUser ? assignedUser.email : caseItem.assignedToXID;
      }
      
      casesWithClientNames.push({
        caseId: caseItem.caseId,
        caseName: caseItem.caseName,
        title: caseItem.title,
        status: caseItem.status,
        category: caseItem.category,
        clientId: caseItem.clientId,
        clientName: client ? client.businessName : 'Unknown',
        assignedTo: assignedToDisplay, // Display email, not xID
        createdAt: caseItem.createdAt,
        createdBy: caseItem.createdBy,
      });
    }
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Docketra Cases Report');
    
    // Define columns
    worksheet.columns = [
      { header: 'Case ID', key: 'caseId', width: 12 },
      { header: 'Case Name', key: 'caseName', width: 20 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Client ID', key: 'clientId', width: 12 },
      { header: 'Client Name', key: 'clientName', width: 25 },
      { header: 'Assigned To', key: 'assignedTo', width: 25 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Created By', key: 'createdBy', width: 25 },
    ];
    
    // Add rows
    casesWithClientNames.forEach(caseItem => {
      worksheet.addRow({
        caseId: caseItem.caseId,
        caseName: caseItem.caseName,
        title: caseItem.title,
        status: caseItem.status,
        category: caseItem.category,
        clientId: caseItem.clientId,
        clientName: caseItem.clientName,
        assignedTo: caseItem.assignedToXID,
        createdAt: caseItem.createdAt.toISOString().replace('T', ' ').substring(0, 19),
        createdBy: caseItem.createdBy,
      });
    });
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E5EC' },
    };
    
    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `docketra-report-${dateStr}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error in exportCasesExcel:', error);
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
    const cappedLimit = Math.min(
      Math.max(parseInt(limit, 10) || DEFAULT_AUDIT_LOG_LIMIT, 1),
      MAX_AUDIT_LOG_LIMIT
    );
    const since = timestamp ? new Date(timestamp) : null;

    const firmId = String(req.firmId || req.user?.firmId || '');
    const caseIdsForFirm = await Case.find({ firmId }).distinct('caseId');
    const caseAuditFilter = { caseId: { $in: caseIdsForFirm } };
    if (xID) caseAuditFilter.performedByXID = xID;
    if (action) caseAuditFilter.actionType = action;
    if (since) caseAuditFilter.timestamp = { $gte: since };

    const authAuditFilter = { firmId };
    if (xID) authAuditFilter.xID = xID;
    if (action) authAuditFilter.actionType = action;
    if (since) authAuditFilter.timestamp = { $gte: since };

    const [caseLogs, authLogs] = await Promise.all([
      CaseAudit.find(caseAuditFilter).sort({ timestamp: -1 }).limit(cappedLimit).lean(),
      AuthAudit.find(authAuditFilter).sort({ timestamp: -1 }).limit(cappedLimit).lean(),
    ]);

    const combined = [
      ...caseLogs.map((item) => ({
        source: 'CaseAudit',
        xID: item.performedByXID,
        action: item.actionType,
        timestamp: item.timestamp,
        description: item.description,
        metadata: item.metadata || null,
      })),
      ...authLogs.map((item) => ({
        source: 'AuthAudit',
        xID: item.xID,
        action: item.actionType,
        timestamp: item.timestamp,
        description: item.description,
        metadata: item.metadata || null,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, cappedLimit);

    return res.json({ success: true, data: combined });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
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
    const { clientId } = req.params;
    if (!/^[A-Za-z0-9_-]+$/.test(String(clientId || ''))) {
      return res.status(400).json({ success: false, message: 'Invalid clientId format' });
    }
    const firmId = req.firmId || req.user?.firmId;
    const client = await Client.findOne({ clientId, firmId }).lean();

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const activeCases = await Case.find({
      firmId,
      clientId,
      status: { $in: ['UNASSIGNED', 'OPEN', 'PENDED', 'UNDER_REVIEW', 'SUBMITTED', 'APPROVED'] },
    })
      .select('caseId caseNumber title status')
      .lean();

    const clientCaseIds = await Case.find({ firmId, clientId }).distinct('_id');
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

module.exports = {
  getCaseMetrics,
  getPendingCasesReport,
  getCasesByDateRange,
  exportCasesCSV,
  exportCasesExcel,
  getAuditLogs,
  generateClientFactSheetPdf,
};
