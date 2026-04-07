const mongoose = require('mongoose');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const User = require('../models/User.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const xIDGenerator = require('../services/xIDGenerator');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const normalizeHeader = (value) => String(value || '').trim().toLowerCase();

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
  if (!text) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line, index) => ({
    rowNumber: index + 2,
    values: splitCsvLine(line, delimiter),
  }));

  return { headers, rows, delimiter };
};

const isEmptyRow = (rowObj, headers) => headers.every((header) => !String(rowObj[header] || '').trim());

const hasExactHeaders = (receivedHeaders, expectedHeaders) => {
  if (receivedHeaders.length !== expectedHeaders.length) return false;
  const normalizedReceived = receivedHeaders.map(normalizeHeader);
  const normalizedExpected = expectedHeaders.map(normalizeHeader);
  return normalizedReceived.every((header, index) => header === normalizedExpected[index]);
};

const buildRowObject = (headers, values) => {
  const row = {};
  headers.forEach((header, index) => {
    row[header] = String(values[index] || '').trim();
  });
  return row;
};

const validateRows = async ({ type, headers, parsedRows, firmId }) => {
  const cfg = TYPE_CONFIG[type];
  const valid = [];
  const invalid = [];
  const seen = new Set();

  let existingLookup = new Set();
  if (type === 'clients') {
    const existing = await Client.find({ firmId, status: { $ne: 'deleted' } }).select('businessEmail').lean();
    existingLookup = new Set(existing.map((entry) => String(entry.businessEmail || '').trim().toLowerCase()).filter(Boolean));
  } else if (type === 'categories') {
    const existing = await Category.find({ firmId, isDeleted: { $ne: true } }).select('name').lean();
    existingLookup = new Set(existing.map((entry) => String(entry.name || '').trim().toLowerCase()));
  } else {
    const existing = await User.find({ firmId, status: { $ne: 'deleted' } }).select('email').lean();
    existingLookup = new Set(existing.map((entry) => String(entry.email || '').trim().toLowerCase()).filter(Boolean));
  }

  parsedRows.forEach(({ rowNumber, values }) => {
    const row = buildRowObject(headers, values);

    if (isEmptyRow(row, headers)) return;

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
      invalid.push({ row: rowNumber, error: `Duplicate row in CSV (${dedupeField})` });
      return;
    }

    if (existingLookup.has(dedupeKey)) {
      invalid.push({ row: rowNumber, error: `Already exists (${dedupeField})` });
      return;
    }

    seen.add(dedupeKey);
    valid.push({ rowNumber, data: row });
  });

  return { valid, invalid };
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

const previewBulkUpload = async (req, res) => {
  const resolved = ensureTypeAndPermission(req, res);
  if (!resolved) return;

  const { type, cfg } = resolved;
  const csvContent = String(req.body?.csvContent || '');

  if (!csvContent.trim()) {
    return res.status(400).json({ success: false, message: 'CSV content is required' });
  }

  const sizeBytes = Buffer.byteLength(csvContent, 'utf8');
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ success: false, message: 'CSV file exceeds 5MB limit' });
  }

  const { headers, rows } = parseCsv(csvContent);

  if (!headers.length) {
    return res.status(400).json({ success: false, message: 'Missing CSV headers' });
  }

  if (!hasExactHeaders(headers, cfg.headers)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CSV headers',
      expected: cfg.headers,
      received: headers,
    });
  }

  const { valid, invalid } = await validateRows({
    type,
    headers: cfg.headers,
    parsedRows: rows,
    firmId: req.user.firmId,
  });

  return res.json({
    success: true,
    data: {
      type,
      headers: cfg.headers,
      valid,
      invalid,
      summary: {
        totalRows: rows.length,
        validRows: valid.length,
        invalidRows: invalid.length,
      },
    },
  });
};

const confirmBulkUpload = async (req, res) => {
  const resolved = ensureTypeAndPermission(req, res);
  if (!resolved) return;

  const { type } = resolved;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ success: false, message: 'No valid rows provided for import' });
  }

  const normalizedRows = rows.map((entry, index) => ({ rowNumber: Number(entry.rowNumber || index + 2), values: Object.values(entry.data || {}) }));
  const { valid, invalid } = await validateRows({
    type,
    headers: TYPE_CONFIG[type].headers,
    parsedRows: normalizedRows,
    firmId: req.user.firmId,
  });

  if (!valid.length) {
    return res.status(400).json({ success: false, message: 'No importable rows after validation', invalid });
  }

  const session = await mongoose.startSession();
  let insertedCount = 0;

  try {
    await session.withTransaction(async () => {
      if (type === 'categories') {
        const docs = valid.map((row) => ({
          firmId: req.user.firmId,
          name: row.data.name.trim(),
          isActive: true,
          subcategories: [],
        }));
        const inserted = await Category.insertMany(docs, { session, ordered: false });
        insertedCount = inserted.length;
      }

      if (type === 'clients') {
        const docs = [];
        for (const row of valid) {
          // keep ID generation aligned with existing client creation behavior
          const clientId = await generateNextClientId(req.user.firmId, session);
          docs.push({
            ...row.data,
            clientId,
            firmId: req.user.firmId,
            createdByXid: req.user.xID,
            createdBy: req.user.email,
            businessEmail: row.data.businessEmail.trim().toLowerCase(),
            isSystemClient: false,
            isActive: true,
            status: 'ACTIVE',
            previousBusinessNames: [],
          });
        }
        const inserted = await Client.insertMany(docs, { session, ordered: false });
        insertedCount = inserted.length;
      }

      if (type === 'team') {
        const docs = [];
        for (const row of valid) {
          const xID = await xIDGenerator.generateNextXID(req.user.firmId, session);
          docs.push({
            xID,
            name: row.data.name.trim(),
            email: row.data.email.trim().toLowerCase(),
            role: row.data.role,
            firmId: req.user.firmId,
            defaultClientId: req.user.defaultClientId || null,
            allowedCategories: [],
            isActive: false,
            status: 'invited',
            mustSetPassword: true,
            passwordSet: false,
            inviteSentAt: null,
          });
        }
        const inserted = await User.insertMany(docs, { session, ordered: false });
        insertedCount = inserted.length;
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        inserted: insertedCount,
        invalid,
      },
      message: insertedCount < rows.length
        ? 'Bulk import completed with partial success'
        : 'Bulk import completed successfully',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Bulk import failed',
      error: error.message,
      invalid,
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  previewBulkUpload,
  confirmBulkUpload,
  TYPE_CONFIG,
};
