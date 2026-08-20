const { randomUUID } = require('crypto');
const { createCase } = require('./case.controller');
const { validateBulkDockets, mapValidationErrors } = require('../services/bulkUpload.service');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const log = require('../utils/log');

const BULK_ASYNC_THRESHOLD = 750;

const parseCsvRows = (csvContent = '') => {
  const text = String(csvContent || '').trim();
  if (!text) return [];

  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  if (!headerLine) return [];

  const headers = headerLine.split(',').map((header) => String(header || '').trim());

  return lines.map((line) => {
    const cells = line.split(',').map((cell) => String(cell || '').trim());
    return headers.reduce((acc, header, idx) => ({ ...acc, [header]: cells[idx] || '' }), {});
  });
};

const resolveRows = (body = {}) => {
  if (Array.isArray(body.rows) && body.rows.length > 0) return body.rows;
  if (typeof body.csvContent === 'string' && body.csvContent.trim()) return parseCsvRows(body.csvContent);
  return [];
};

const generateDocketImportTemplate = async (req, res) => {
  try {
    const firmId = req.user.firmId;
    const [clients, teams, categories] = await Promise.all([
      Client.find({ firmId, status: { $in: ['active', 'Lead'] } }).select('clientId businessName').lean(),
      Team.find({ firmId, isActive: true }).select('name').lean(),
      Category.find({ firmId, isActive: true }).select('name subcategories').lean(),
    ]);

    const sampleTeam = teams[0]?.name || 'General Operations';
    const sampleCategory = categories[0]?.name || 'General';
    const sampleSubcategory = categories[0]?.subcategories?.find((sub) => sub?.isActive)?.name || 'General Task';

    const headers = [
      'docketId',
      'clientId',
      'clientName',
      'workbasket',
      'category',
      'subcategory',
      'title',
      'description',
      'assignedToEmail',
      'startDate',
      'completedDate',
      'status',
      'priority',
    ];

    const sampleRows = clients.length > 0
      ? clients.map((c, i) => [
        `DCK-IMPORT-${1000 + i}`,
        c.clientId || '',
        `"${c.businessName || ''}"`,
        sampleTeam,
        sampleCategory,
        sampleSubcategory,
        `Historical Task for ${c.businessName}`,
        'Historical docket record imported during onboarding',
        req.user.email || '',
        '2023-01-15',
        '2023-01-20',
        'RESOLVED',
        'medium',
      ].join(','))
      : [
        [
          'DCK-IMPORT-1001',
          'C000001',
          '"Sample Client Ltd"',
          sampleTeam,
          sampleCategory,
          sampleSubcategory,
          'Annual Compliance Filing 2023',
          'Historical docket imported during onboarding',
          req.user.email || 'admin@firm.com',
          '2023-01-15',
          '2023-01-20',
          'RESOLVED',
          'medium',
        ].join(','),
      ];

    const csvContent = [headers.join(','), ...sampleRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Docketra_Historical_Dockets_Template.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    log.error('[DOCKET_BULK_TEMPLATE] Failed to generate docket import template', error);
    return res.status(500).json({ success: false, message: 'Failed to generate docket import template' });
  }
};

const previewDocketBulkUpload = async (req, res) => {
  try {
    const rows = resolveRows(req.body);
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No rows supplied for preview' });
    }

    const validation = await validateBulkDockets(rows, req.user.firmId);
    const validRows = validation.filter((row) => row.isValid).length;
    const invalidRows = validation.length - validRows;

    return res.json({
      success: true,
      results: validation,
      summary: {
        totalRows: validation.length,
        validRows,
        invalidRows,
      },
      futureReady: {
        asyncSuggested: validation.length > BULK_ASYNC_THRESHOLD,
        threshold: BULK_ASYNC_THRESHOLD,
      },
    });
  } catch (error) {
    log.error('[DOCKET_BULK_PREVIEW] Failed to preview bulk upload', error);
    return res.status(500).json({ success: false, message: 'Failed to preview docket bulk upload' });
  }
};

const invokeCreateCase = async (req, row) => {
  const body = {
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    workbasketId: row.workbasketId,
    priority: row.priority,
    clientId: row.clientId,
    status: row.status || 'RESOLVED',
    startDate: row.startDate,
    completedDate: row.completedDate,
    assignedTo: row.assignedTo,
    isHistoricalImport: row.isHistoricalImport !== false,
  };

  const innerReq = {
    ...req,
    body,
    headers: req.headers || {},
    requestId: randomUUID(),
  };

  return new Promise((resolve) => {
    const result = {
      statusCode: 200,
      payload: null,
    };
    const innerRes = {
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.payload = payload;
        resolve(result);
        return this;
      },
    };

    createCase(innerReq, innerRes);
  });
};

const uploadDocketBulk = async (req, res) => {
  try {
    const rows = resolveRows(req.body);
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No rows supplied for upload' });
    }

    const rejectOnInvalid = Boolean(req.body?.rejectOnInvalid);
    const uploadValidRowsOnly = req.body?.uploadValidRowsOnly !== false;

    const validation = await validateBulkDockets(rows, req.user.firmId);
    const invalidRows = validation.filter((entry) => !entry.isValid);

    if (rejectOnInvalid && invalidRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Upload rejected because invalid rows were found',
        created: 0,
        failed: invalidRows.length,
        errors: invalidRows.map((row) => ({ rowIndex: row.rowIndex, errors: mapValidationErrors(row) })),
      });
    }

    const rowsToCreate = uploadValidRowsOnly ? validation.filter((entry) => entry.isValid) : validation;

    let created = 0;
    const errors = invalidRows.map((row) => ({ rowIndex: row.rowIndex, errors: mapValidationErrors(row) }));

    for (const rowEntry of rowsToCreate) {
      if (!rowEntry.isValid) continue;

      // eslint-disable-next-line no-await-in-loop
      const result = await invokeCreateCase(req, rowEntry.normalizedData);
      if (result.statusCode >= 200 && result.statusCode < 300 && result.payload?.success) {
        created += 1;
      } else {
        errors.push({
          rowIndex: rowEntry.rowIndex,
          errors: [result.payload?.message || 'Failed to create docket'],
        });
      }
    }

    return res.json({
      success: true,
      created,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    log.error('[DOCKET_BULK_UPLOAD] Failed to upload dockets', error);
    return res.status(500).json({ success: false, message: 'Failed to upload dockets in bulk' });
  }
};

module.exports = {
  generateDocketImportTemplate,
  previewDocketBulkUpload,
  uploadDocketBulk,
};
