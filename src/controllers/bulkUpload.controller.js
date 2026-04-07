const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const User = require('../models/User.model');
const BulkUploadJob = require('../models/BulkUploadJob.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const xIDGenerator = require('../services/xIDGenerator');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ASYNC_ROW_THRESHOLD = 500;

const TYPE_CONFIG = {
  clients: {
    headers: [
      'businessName',
      'businessAddress',
      'primaryContactNumber',
      'businessEmail',
      'secondaryContactNumber',
      'PAN',
      'TAN',
      'GST',
      'CIN',
      'contactPersonName',
      'contactPersonDesignation',
      'contactPersonPhoneNumber',
      'contactPersonEmailAddress',
    ],
    required: ['businessName', 'businessAddress', 'primaryContactNumber', 'businessEmail'],
    duplicateKey: 'businessEmail',
    permission: 'CLIENT_MANAGE',
  },
  categories: {
    headers: ['name'],
    required: ['name'],
    duplicateKey: 'name',
    permission: 'CATEGORY_MANAGE',
  },
  team: {
    headers: ['name', 'email', 'role'],
    required: ['name', 'email', 'role'],
    duplicateKey: 'email',
    permission: 'USER_MANAGE',
  },
};

const HEADER_ALIASES = {
  clients: {
    businessName: ['businessname', 'name', 'client_name'],
    businessAddress: ['businessaddress', 'address', 'client_address'],
    primaryContactNumber: ['primarycontactnumber', 'phone', 'mobile'],
    businessEmail: ['businessemail', 'email', 'client_email'],
    secondaryContactNumber: ['secondarycontactnumber', 'alt_phone', 'alternate_phone'],
    PAN: ['pan'],
    TAN: ['tan'],
    GST: ['gst', 'gstin'],
    CIN: ['cin'],
    contactPersonName: ['contactpersonname', 'contact_name'],
    contactPersonDesignation: ['contactpersondesignation', 'designation'],
    contactPersonPhoneNumber: ['contactpersonphonenumber', 'contact_phone'],
    contactPersonEmailAddress: ['contactpersonemailaddress', 'contact_email'],
  },
  categories: {
    name: ['name', 'category_name'],
  },
  team: {
    name: ['name', 'full_name'],
    email: ['email', 'work_email'],
    role: ['role', 'user_role'],
  },
};

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const normalizeHeader = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const splitCsvLine = (line, delimiter) => {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
};

const detectDelimiter = (headerLine) => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
};

const parseCsv = (content) => {
  const text = String(content || '').replace(/^\uFEFF/, '').trim();
  if (!text) return { headers: [], rows: [] };

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line, index) => ({ rowNumber: index + 2, values: splitCsvLine(line, delimiter) }));

  return { headers, rows };
};

const parseXlsx = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  if (!Array.isArray(matrix) || matrix.length === 0) return { headers: [], rows: [] };

  const headers = (matrix[0] || []).map((cell) => String(cell || '').trim());
  const rows = matrix.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    values: headers.map((_, colIndex) => String(row?.[colIndex] || '').trim()),
  }));

  return { headers, rows };
};

const resolveInputData = (body) => {
  const csvContent = String(body?.csvContent || '');
  if (csvContent.trim()) return { fileType: 'csv', sizeBytes: Buffer.byteLength(csvContent, 'utf8'), parsed: parseCsv(csvContent) };

  const base64 = String(body?.fileContentBase64 || '');
  if (!base64) return { fileType: null, sizeBytes: 0, parsed: { headers: [], rows: [] } };

  const fileBuffer = Buffer.from(base64, 'base64');
  const fileName = String(body?.fileName || '').toLowerCase();
  const fileType = fileName.endsWith('.xlsx') ? 'xlsx' : 'csv';

  if (fileType === 'xlsx') return { fileType, sizeBytes: fileBuffer.length, parsed: parseXlsx(fileBuffer) };
  return { fileType: 'csv', sizeBytes: fileBuffer.length, parsed: parseCsv(fileBuffer.toString('utf8')) };
};

const mapHeaders = ({ type, receivedHeaders, cfg, manualMapping = {} }) => {
  const aliases = HEADER_ALIASES[type] || {};
  const normalizedReceived = receivedHeaders.map(normalizeHeader);
  const usedIndexes = new Set();
  const fieldIndexMap = {};

  Object.entries(manualMapping || {}).forEach(([sourceHeader, targetField]) => {
    if (!cfg.headers.includes(targetField)) return;
    const sourceIndex = receivedHeaders.findIndex((header) => header === sourceHeader);
    if (sourceIndex >= 0 && !usedIndexes.has(sourceIndex)) {
      usedIndexes.add(sourceIndex);
      fieldIndexMap[targetField] = sourceIndex;
    }
  });

  cfg.headers.forEach((field) => {
    if (typeof fieldIndexMap[field] === 'number') return;
    const normalizedCandidates = [field, ...(aliases[field] || [])].map(normalizeHeader);
    const index = normalizedReceived.findIndex((header, idx) => !usedIndexes.has(idx) && normalizedCandidates.includes(header));
    if (index >= 0) {
      usedIndexes.add(index);
      fieldIndexMap[field] = index;
    }
  });

  const missingRequired = cfg.required.filter((field) => typeof fieldIndexMap[field] !== 'number');
  return { fieldIndexMap, missingRequired };
};

const buildRowObject = (fieldIndexMap, values) => Object.entries(fieldIndexMap).reduce((acc, [field, index]) => {
  acc[field] = String(values[index] || '').trim();
  return acc;
}, {});

const isEmptyRow = (rowObj) => Object.values(rowObj).every((value) => !String(value || '').trim());

const fetchExistingLookup = async ({ type, firmId }) => {
  if (type === 'clients') {
    const existing = await Client.find({ firmId, status: { $ne: 'deleted' } }).select('businessEmail').lean();
    return new Set(existing.map((entry) => String(entry.businessEmail || '').trim().toLowerCase()).filter(Boolean));
  }
  if (type === 'categories') {
    const existing = await Category.find({ firmId, isDeleted: { $ne: true } }).select('name').lean();
    return new Set(existing.map((entry) => String(entry.name || '').trim().toLowerCase()).filter(Boolean));
  }
  const existing = await User.find({ firmId, status: { $ne: 'deleted' } }).select('email').lean();
  return new Set(existing.map((entry) => String(entry.email || '').trim().toLowerCase()).filter(Boolean));
};

const validateRows = async ({ type, parsedRows, fieldIndexMap, firmId, duplicateMode = 'skip' }) => {
  const cfg = TYPE_CONFIG[type];
  const valid = [];
  const invalid = [];
  const skipped = [];
  const seen = new Set();
  const existingLookup = await fetchExistingLookup({ type, firmId });

  parsedRows.forEach(({ rowNumber, values }) => {
    const row = buildRowObject(fieldIndexMap, values);
    if (isEmptyRow(row)) return;

    for (const reqField of cfg.required) {
      if (!String(row[reqField] || '').trim()) {
        invalid.push({ row: rowNumber, error: `Missing required field: ${reqField}` });
        return;
      }
    }

    if (type === 'clients' && !EMAIL_REGEX.test(String(row.businessEmail || '').trim())) {
      invalid.push({ row: rowNumber, error: 'Invalid email in businessEmail' });
      return;
    }
    if (type === 'team' && !EMAIL_REGEX.test(String(row.email || '').trim())) {
      invalid.push({ row: rowNumber, error: 'Invalid email' });
      return;
    }
    if (type === 'team') {
      const role = String(row.role || '').trim();
      if (!['Admin', 'Employee'].includes(role)) {
        invalid.push({ row: rowNumber, error: 'Invalid role. Allowed: Admin, Employee' });
        return;
      }
    }

    const dedupeField = cfg.duplicateKey;
    const dedupeKey = String(row[dedupeField] || '').trim().toLowerCase();
    if (!dedupeKey) {
      invalid.push({ row: rowNumber, error: `Missing dedupe field: ${dedupeField}` });
      return;
    }

    if (seen.has(dedupeKey)) {
      invalid.push({ row: rowNumber, error: `Duplicate row in file (${dedupeField})` });
      return;
    }

    const exists = existingLookup.has(dedupeKey);
    if (exists && duplicateMode === 'fail') {
      invalid.push({ row: rowNumber, error: `Already exists (${dedupeField})` });
      return;
    }
    if (exists && duplicateMode === 'skip') {
      skipped.push({ row: rowNumber, reason: `Skipped existing (${dedupeField})` });
      return;
    }

    seen.add(dedupeKey);
    valid.push({ rowNumber, data: row, dedupeKey, action: exists ? 'update' : 'create' });
  });

  return { valid, invalid, skipped };
};

const ensureTypeAndPermission = (req, res) => {
  const type = String(req.params.type || '').trim().toLowerCase();
  const cfg = TYPE_CONFIG[type];

  if (!cfg) {
    res.status(400).json({ success: false, message: 'Invalid bulk upload type' });
    return null;
  }

  if (!Array.isArray(req.firmPermissions) || !req.firmPermissions.includes(cfg.permission)) {
    res.status(403).json({ success: false, message: 'Insufficient firm permissions' });
    return null;
  }

  return { type, cfg };
};

const processBulkRows = async ({ type, rows, user, duplicateMode, jobId = null }) => {
  const updateProgress = async (patch) => {
    if (!jobId) return;
    await BulkUploadJob.findByIdAndUpdate(jobId, patch);
  };

  await updateProgress({ status: 'processing' });

  let successCount = 0;
  let failureCount = 0;
  const results = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      if (type === 'categories') {
        if (row.action === 'update') {
          await Category.updateOne(
            { firmId: user.firmId, name: row.dedupeKey, isDeleted: { $ne: true } },
            { $set: { name: row.data.name.trim(), isActive: true } },
          );
        } else {
          await Category.create({ firmId: user.firmId, name: row.data.name.trim(), isActive: true, subcategories: [] });
        }
      }

      if (type === 'clients') {
        if (row.action === 'update') {
          await Client.updateOne(
            { firmId: user.firmId, businessEmail: row.dedupeKey, status: { $ne: 'deleted' } },
            {
              $set: {
                ...row.data,
                businessEmail: row.data.businessEmail.trim().toLowerCase(),
              },
            },
          );
        } else {
          const clientId = await generateNextClientId(user.firmId);
          await Client.create({
            ...row.data,
            clientId,
            firmId: user.firmId,
            createdByXid: user.xID,
            createdBy: user.email,
            businessEmail: row.data.businessEmail.trim().toLowerCase(),
            isSystemClient: false,
            isActive: true,
            status: 'ACTIVE',
            previousBusinessNames: [],
          });
        }
      }

      if (type === 'team') {
        if (row.action === 'update') {
          await User.updateOne(
            { firmId: user.firmId, email: row.dedupeKey, status: { $ne: 'deleted' } },
            { $set: { name: row.data.name.trim(), role: row.data.role } },
          );
        } else {
          const xID = await xIDGenerator.generateNextXID(user.firmId);
          await User.create({
            xID,
            name: row.data.name.trim(),
            email: row.data.email.trim().toLowerCase(),
            role: row.data.role,
            firmId: user.firmId,
            defaultClientId: user.defaultClientId || null,
            allowedCategories: [],
            isActive: false,
            status: 'invited',
            mustSetPassword: true,
            passwordSet: false,
            inviteSentAt: null,
          });
        }
      }

      successCount += 1;
      results.push({ row: row.rowNumber, status: row.action });
    } catch (error) {
      failureCount += 1;
      results.push({ row: row.rowNumber, status: 'failed', error: error.message });
    }

    await updateProgress({
      processed: index + 1,
      successCount,
      failureCount,
      results: results.slice(-200),
    });
  }

  if (jobId) {
    await updateProgress({
      status: failureCount > 0 && successCount === 0 ? 'failed' : 'completed',
      processed: rows.length,
      successCount,
      failureCount,
      duplicateMode,
      results: results.slice(-500),
    });
  }

  return { successCount, failureCount, results };
};

const previewBulkUpload = async (req, res) => {
  const resolved = ensureTypeAndPermission(req, res);
  if (!resolved) return;

  const { type, cfg } = resolved;
  const duplicateMode = ['skip', 'update', 'fail'].includes(String(req.body?.duplicateMode || '').toLowerCase())
    ? String(req.body.duplicateMode).toLowerCase()
    : 'skip';

  const { sizeBytes, fileType, parsed } = resolveInputData(req.body || {});

  if (!fileType) {
    return res.status(400).json({ success: false, message: 'CSV/XLSX content is required' });
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ success: false, message: 'File exceeds 5MB limit' });
  }

  const { headers, rows } = parsed;

  if (!headers.length) {
    return res.status(400).json({ success: false, message: 'Missing file headers' });
  }

  const { fieldIndexMap, missingRequired } = mapHeaders({
    type,
    receivedHeaders: headers,
    cfg,
    manualMapping: req.body?.headerMapping || {},
  });
  if (missingRequired.length) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      missing: missingRequired,
      received: headers,
    });
  }

  const { valid, invalid, skipped } = await validateRows({
    type,
    parsedRows: rows,
    fieldIndexMap,
    firmId: req.user.firmId,
    duplicateMode,
  });

  return res.json({
    success: true,
    data: {
      type,
      fileType,
      headers: cfg.headers,
      receivedHeaders: headers,
      fieldIndexMap,
      valid,
      invalid,
      skipped,
      summary: {
        totalRows: rows.length,
        validRows: valid.length,
        invalidRows: invalid.length,
        skippedRows: skipped.length,
      },
    },
  });
};

const confirmBulkUpload = async (req, res) => {
  const resolved = ensureTypeAndPermission(req, res);
  if (!resolved) return;

  const { type } = resolved;
  const duplicateMode = ['skip', 'update', 'fail'].includes(String(req.body?.duplicateMode || '').toLowerCase())
    ? String(req.body.duplicateMode).toLowerCase()
    : 'skip';
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ success: false, message: 'No valid rows provided for import' });
  }

  const shouldAsync = Boolean(req.body?.async) || rows.length >= ASYNC_ROW_THRESHOLD;

  if (!shouldAsync) {
    const { successCount, results } = await processBulkRows({ type, rows, user: req.user, duplicateMode });
    return res.status(201).json({
      success: true,
      data: {
        inserted: successCount,
        invalid: results.filter((entry) => entry.status === 'failed'),
      },
      message: successCount < rows.length
        ? 'Bulk import completed with partial success'
        : 'Bulk import completed successfully',
    });
  }

  const job = await BulkUploadJob.create({
    type,
    status: 'pending',
    total: rows.length,
    processed: 0,
    successCount: 0,
    failureCount: 0,
    duplicateMode,
    results: [],
    createdBy: {
      userId: req.user._id,
      firmId: req.user.firmId,
      email: req.user.email,
      xID: req.user.xID,
    },
  });

  setImmediate(async () => {
    try {
      await processBulkRows({ type, rows, user: req.user, duplicateMode, jobId: job._id });
    } catch (error) {
      await BulkUploadJob.findByIdAndUpdate(job._id, {
        status: 'failed',
        errorMessage: error.message,
      });
    }
  });

  return res.status(202).json({
    success: true,
    data: {
      jobId: job._id,
      status: 'processing',
    },
    message: 'Bulk import started',
  });
};

const getBulkUploadJobStatus = async (req, res) => {
  const { jobId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return res.status(400).json({ success: false, message: 'Invalid job id' });
  }

  const job = await BulkUploadJob.findOne({
    _id: jobId,
    'createdBy.firmId': req.user.firmId,
  }).lean();

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  return res.json({
    success: true,
    data: {
      status: job.status,
      progress,
      success: job.successCount,
      failed: job.failureCount,
      total: job.total,
      processed: job.processed,
      results: job.results || [],
    },
  });
};

module.exports = {
  previewBulkUpload,
  confirmBulkUpload,
  getBulkUploadJobStatus,
  TYPE_CONFIG,
};
