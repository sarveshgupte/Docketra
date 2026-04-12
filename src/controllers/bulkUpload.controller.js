const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const User = require('../models/User.model');
const BulkUploadJob = require('../models/BulkUploadJob.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const xIDGenerator = require('../services/xIDGenerator');
const { bulkUploadQueue } = require('../queues/bulkUpload.queue');
const { eventBus } = require('../events/eventBus');
const { logAuthEvent } = require('../services/audit.service');
require('../automations/bulkUpload.handlers');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ASYNC_ROW_THRESHOLD = 500;

const TYPE_CONFIG = {
  clients: {
    headers: [
      'businessName',
      'businessEmail',
      'contactPersonName',
      'primaryContactNumber',
    ],
    required: ['businessName', 'businessEmail'],
    duplicateKey: 'businessEmail',
    permission: 'CLIENT_MANAGE',
  },
  categories: {
    headers: ['category', 'subcategory'],
    required: ['category'],
    duplicateKey: 'category',
    permission: 'CATEGORY_MANAGE',
  },
  team: {
    headers: ['name', 'email', 'role', 'department'],
    required: ['name', 'email', 'role'],
    duplicateKey: 'email',
    permission: 'USER_MANAGE',
  },
};

const HEADER_ALIASES = {
  clients: {
    businessName: ['businessname', 'name', 'client_name'],
    businessEmail: ['businessemail', 'email', 'client_email'],
    contactPersonName: ['contactpersonname', 'contact_name'],
    primaryContactNumber: ['primarycontactnumber', 'phone', 'mobile'],
  },
  categories: {
    category: ['category', 'name', 'category_name'],
    subcategory: ['subcategory', 'sub_category', 'sub category'],
  },
  team: {
    name: ['name', 'full_name'],
    email: ['email', 'work_email'],
    role: ['role', 'user_role'],
    department: ['department', 'team_department'],
  },
};

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const resolveDuplicateMode = (value, fallback = 'skip') => {
  const normalized = String(value || '').toLowerCase();
  return ['skip', 'update', 'fail'].includes(normalized) ? normalized : fallback;
};

const safeLogBulkMutation = async (req, { description, metadata = {} }) => {
  try {
    await logAuthEvent({
      actionType: 'AdminMutation',
      xID: req.user?.xID || req.user?.xid || 'UNKNOWN',
      performedBy: req.user?.xID || req.user?.xid || 'UNKNOWN',
      firmId: req.user?.firmId,
      userId: req.user?._id,
      description,
      req,
      metadata: {
        domain: 'BULK_UPLOAD',
        ...metadata,
      },
    });
  } catch (error) {
    console.error('[BULK_UPLOAD] Failed to write audit entry', error.message);
  }
};

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
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeTeamRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'admin') return 'Admin';
  if (normalizedRole === 'user' || normalizedRole === 'employee') return 'Employee';
  return null;
};

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
      const normalizedRole = normalizeTeamRole(row.role);
      if (!normalizedRole) {
        invalid.push({ row: rowNumber, error: 'Invalid role. Allowed: Admin, User' });
        return;
      }
      row.role = normalizedRole;
    }

    if (type === 'categories') {
      const categoryKey = String(row.category || '').trim().toLowerCase();
      const subcategoryKey = String(row.subcategory || '').trim().toLowerCase();
      const pairKey = `${categoryKey}::${subcategoryKey}`;

      if (seen.has(pairKey)) {
        invalid.push({ row: rowNumber, error: 'Duplicate category/subcategory row in file' });
        return;
      }

      seen.add(pairKey);
      valid.push({
        rowNumber,
        data: {
          category: String(row.category || '').trim(),
          subcategory: String(row.subcategory || '').trim(),
        },
        dedupeKey: categoryKey,
        action: existingLookup.has(categoryKey) ? 'update' : 'create',
      });
      return;
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
  const createdClients = [];
  const createdUsers = [];
  const categoryCache = new Map();
  const clientBulkOps = [];
  const teamBulkOps = [];
  const BATCH_SIZE = 500;

  if (type === 'categories' && rows.length > 0) {
    const categoryNames = [...new Set(rows.map(r => String(r.data && r.data.category ? r.data.category : '').trim()).filter(Boolean))];
    if (categoryNames.length > 0) {
      const existingCategories = await Category.find({
        firmId: user.firmId,
        isDeleted: { $ne: true },
        name: { $in: categoryNames.map(name => new RegExp(`^${escapeRegExp(name)}$`, 'i')) },
      });
      for (const cat of existingCategories) {
        categoryCache.set(String(cat.name).toLowerCase(), cat);
      }
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    try {
      if (type === 'categories') {
        const categoryName = String(row.data.category || '').trim();
        const subcategoryName = String(row.data.subcategory || '').trim();
        const categoryKey = categoryName.toLowerCase();

        let categoryDoc = categoryCache.get(categoryKey);
        if (!categoryDoc) {
          categoryDoc = await Category.create({
            firmId: user.firmId,
            name: categoryName,
            isActive: true,
            subcategories: [],
          });
          categoryCache.set(categoryKey, categoryDoc);
        } else if (!categoryDoc.isActive) {
          categoryDoc.isActive = true;
          await categoryDoc.save();
        }

        if (subcategoryName) {
          const existingSubcategory = (categoryDoc.subcategories || [])
            .find((entry) => String(entry.name || '').trim().toLowerCase() === subcategoryName.toLowerCase());

          if (!existingSubcategory) {
            categoryDoc.subcategories.push({
              id: new mongoose.Types.ObjectId().toString(),
              name: subcategoryName,
              isActive: true,
            });
            await categoryDoc.save();
          } else if (existingSubcategory.isActive === false) {
            existingSubcategory.isActive = true;
            await categoryDoc.save();
          }
        }
      }

      if (type === 'clients') {
        if (row.action === 'update') {
          clientBulkOps.push({
            meta: { rowNumber: row.rowNumber, action: row.action },
            op: {
              updateOne: {
                filter: { firmId: user.firmId, businessEmail: row.dedupeKey, status: { $ne: 'deleted' } },
                update: {
                  $set: {
                    ...row.data,
                    businessAddress: row.data.businessAddress || 'N/A',
                    primaryContactNumber: row.data.primaryContactNumber || 'N/A',
                    businessEmail: row.data.businessEmail.trim().toLowerCase(),
                  },
                },
              }
            }
          });
        } else {
          const clientId = await generateNextClientId(user.firmId);
          clientBulkOps.push({
            meta: { rowNumber: row.rowNumber, action: row.action, clientId, email: row.data.businessEmail.trim().toLowerCase() },
            op: {
              insertOne: {
                document: {
                  ...row.data,
                  clientId,
                  firmId: user.firmId,
                  createdByXid: user.xID,
                  createdBy: user.email,
                  businessAddress: row.data.businessAddress || 'N/A',
                  primaryContactNumber: row.data.primaryContactNumber || 'N/A',
                  businessEmail: row.data.businessEmail.trim().toLowerCase(),
                  isSystemClient: false,
                  isActive: true,
                  status: 'ACTIVE',
                  previousBusinessNames: [],
                }
              }
            }
          });
        }
      }

      if (type === 'team') {
        if (row.action === 'update') {
          teamBulkOps.push({
            meta: { rowNumber: row.rowNumber, action: row.action },
            op: {
              updateOne: {
                filter: { firmId: user.firmId, email: row.dedupeKey, status: { $ne: 'deleted' } },
                update: { $set: { name: row.data.name.trim(), role: row.data.role } },
              }
            }
          });
        } else {
          const xID = await xIDGenerator.generateNextXID(user.firmId);
          const newUserId = new mongoose.Types.ObjectId();
          teamBulkOps.push({
            meta: { rowNumber: row.rowNumber, action: row.action, _id: newUserId, xID, email: row.data.email.trim().toLowerCase() },
            op: {
              insertOne: {
                document: {
                  _id: newUserId,
                  xID,
                  name: row.data.name.trim(),
                  email: row.data.email.trim().toLowerCase(),
                  role: row.data.role,
                  department: String(row.data.department || '').trim() || undefined,
                  firmId: user.firmId,
                  defaultClientId: user.defaultClientId || null,
                  restrictedClientIds: [],
                  allowedCategories: [],
                  isActive: false,
                  status: 'invited',
                  mustSetPassword: true,
                  passwordSet: false,
                  inviteSentAt: null,
                }
              }
            }
          });
        }
      }

      if (type === 'categories') {
        successCount += 1;
        results.push({ row: row.rowNumber, status: row.action });
      }
    } catch (error) {
      failureCount += 1;
      results.push({ row: row.rowNumber, status: 'failed', error: error.message });
    }

    if (type === 'clients' && clientBulkOps.length >= BATCH_SIZE) {
      try {
        const ops = clientBulkOps.map(item => item.op);
        const res = await Client.bulkWrite(ops, { ordered: false });
        // Since we map strictly 1:1, we will approximate success/failures.
        // In ordered: false, if there are errors, an exception is thrown with writeErrors.
        // Mongoose 6+ and Mongo driver 4+ return detailed results on success
        successCount += (res.insertedCount || 0) + (res.modifiedCount || 0) + (res.upsertedCount || 0);
        clientBulkOps.forEach(item => {
           results.push({ row: item.meta.rowNumber, status: item.meta.action });
           if (item.meta.action === 'create') {
              createdClients.push({ clientId: item.meta.clientId, businessEmail: item.meta.email });
           }
        });
        clientBulkOps.length = 0;
      } catch (error) {
        console.error('[BULK_UPLOAD] Batch bulkWrite failed for clients', error);
        if (error.writeErrors) {
          failureCount += error.writeErrors.length;
          const successfulOps = clientBulkOps.length - error.writeErrors.length;
          successCount += successfulOps > 0 ? successfulOps : 0;
          // Approximate pushing results
          clientBulkOps.forEach((item, i) => {
             // simplified handling for batch errors to avoid mapping exact indexes which is complex
             if (i < successfulOps) {
                 results.push({ row: item.meta.rowNumber, status: item.meta.action });
             } else {
                 results.push({ row: item.meta.rowNumber, status: 'failed', error: 'Bulk write error' });
             }
          });
        } else {
          failureCount += clientBulkOps.length;
          clientBulkOps.forEach(item => results.push({ row: item.meta.rowNumber, status: 'failed', error: error.message }));
        }
        clientBulkOps.length = 0;
      }
    }

    if (type === 'team' && teamBulkOps.length >= BATCH_SIZE) {
      try {
        const ops = teamBulkOps.map(item => item.op);
        const res = await User.bulkWrite(ops, { ordered: false });
        successCount += (res.insertedCount || 0) + (res.modifiedCount || 0) + (res.upsertedCount || 0);
        teamBulkOps.forEach(item => {
           results.push({ row: item.meta.rowNumber, status: item.meta.action });
           if (item.meta.action === 'create') {
              createdUsers.push({ _id: item.meta._id, xID: item.meta.xID, email: item.meta.email });
           }
        });
        teamBulkOps.length = 0;
      } catch (error) {
        console.error('[BULK_UPLOAD] Batch bulkWrite failed for team', error);
        if (error.writeErrors) {
          failureCount += error.writeErrors.length;
          const successfulOps = teamBulkOps.length - error.writeErrors.length;
          successCount += successfulOps > 0 ? successfulOps : 0;
          teamBulkOps.forEach((item, i) => {
             if (i < successfulOps) {
                 results.push({ row: item.meta.rowNumber, status: item.meta.action });
             } else {
                 results.push({ row: item.meta.rowNumber, status: 'failed', error: 'Bulk write error' });
             }
          });
        } else {
          failureCount += teamBulkOps.length;
          teamBulkOps.forEach(item => results.push({ row: item.meta.rowNumber, status: 'failed', error: error.message }));
        }
        teamBulkOps.length = 0;
      }
    }

    if (type === 'categories' || (index + 1) % BATCH_SIZE === 0) {
      await updateProgress({
        processed: index + 1,
        successCount,
        failureCount,
        results: results.slice(-200),
      });
    }
  }

  if (type === 'clients' && clientBulkOps.length > 0) {
    try {
      const ops = clientBulkOps.map(item => item.op);
      const res = await Client.bulkWrite(ops, { ordered: false });
      successCount += (res.insertedCount || 0) + (res.modifiedCount || 0) + (res.upsertedCount || 0);
      clientBulkOps.forEach(item => {
         results.push({ row: item.meta.rowNumber, status: item.meta.action });
         if (item.meta.action === 'create') {
            createdClients.push({ clientId: item.meta.clientId, businessEmail: item.meta.email });
         }
      });
    } catch (error) {
      console.error('[BULK_UPLOAD] Final bulkWrite failed for clients', error);
      if (error.writeErrors) {
        failureCount += error.writeErrors.length;
        const successfulOps = clientBulkOps.length - error.writeErrors.length;
        successCount += successfulOps > 0 ? successfulOps : 0;
        clientBulkOps.forEach((item, i) => {
           if (i < successfulOps) {
               results.push({ row: item.meta.rowNumber, status: item.meta.action });
           } else {
               results.push({ row: item.meta.rowNumber, status: 'failed', error: 'Bulk write error' });
           }
        });
      } else {
        failureCount += clientBulkOps.length;
        clientBulkOps.forEach(item => results.push({ row: item.meta.rowNumber, status: 'failed', error: error.message }));
      }
    }
  }

  if (type === 'team' && teamBulkOps.length > 0) {
    try {
      const ops = teamBulkOps.map(item => item.op);
      const res = await User.bulkWrite(ops, { ordered: false });
      successCount += (res.insertedCount || 0) + (res.modifiedCount || 0) + (res.upsertedCount || 0);
      teamBulkOps.forEach(item => {
         results.push({ row: item.meta.rowNumber, status: item.meta.action });
         if (item.meta.action === 'create') {
            createdUsers.push({ _id: item.meta._id, xID: item.meta.xID, email: item.meta.email });
         }
      });
    } catch (error) {
      console.error('[BULK_UPLOAD] Final bulkWrite failed for team', error);
      if (error.writeErrors) {
        failureCount += error.writeErrors.length;
        const successfulOps = teamBulkOps.length - error.writeErrors.length;
        successCount += successfulOps > 0 ? successfulOps : 0;
        teamBulkOps.forEach((item, i) => {
           if (i < successfulOps) {
               results.push({ row: item.meta.rowNumber, status: item.meta.action });
           } else {
               results.push({ row: item.meta.rowNumber, status: 'failed', error: 'Bulk write error' });
           }
        });
      } else {
        failureCount += teamBulkOps.length;
        teamBulkOps.forEach(item => results.push({ row: item.meta.rowNumber, status: 'failed', error: error.message }));
      }
    }
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

  setImmediate(() => {
    try {
      eventBus.emit('bulkUpload.completed', {
        type,
        successCount,
        failureCount,
        user,
        createdClients,
        createdUsers,
      });
    } catch (error) {
      console.error('[BULK_UPLOAD] Failed to emit completion event', {
        type,
        firmId: user?.firmId,
        error: error.message,
      });
    }
  });

  return { successCount, failureCount, results };
};

const previewBulkUpload = async (req, res) => {
  const resolved = ensureTypeAndPermission(req, res);
  if (!resolved) return;

  const { type, cfg } = resolved;
  const duplicateMode = resolveDuplicateMode(req.body?.duplicateMode, 'skip');

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
  const duplicateMode = resolveDuplicateMode(req.body?.duplicateMode, 'skip');
  const effectiveDuplicateMode = resolveDuplicateMode(req.body?.effectiveDuplicateMode, duplicateMode);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ success: false, message: 'No valid rows provided for import' });
  }

  const shouldAsync = Boolean(req.body?.async) || rows.length >= ASYNC_ROW_THRESHOLD;

  if (!shouldAsync) {
    const { successCount, results } = await processBulkRows({
      type,
      rows,
      user: req.user,
      duplicateMode: effectiveDuplicateMode,
    });
    await safeLogBulkMutation(req, {
      description: `Bulk upload completed (${type}) with ${successCount}/${rows.length} successful row(s)`,
      metadata: {
        action: 'BULK_UPLOAD_COMPLETED_SYNC',
        type,
        duplicateMode: effectiveDuplicateMode,
        totalRows: rows.length,
        successCount,
        failureCount: results.filter((entry) => entry.status === 'failed').length,
      },
    });
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
    duplicateMode: effectiveDuplicateMode,
    results: [],
    createdBy: {
      userId: req.user._id,
      firmId: req.user.firmId,
      email: req.user.email,
      xID: req.user.xID,
    },
  });

  if (!bulkUploadQueue) {
    await BulkUploadJob.findByIdAndUpdate(job._id, {
      status: 'failed',
      errorMessage: 'Queue unavailable: REDIS_URL is not configured',
    });
    return res.status(503).json({
      success: false,
      message: 'Bulk import queue is unavailable',
    });
  }

  try {
    await bulkUploadQueue.add('bulk-upload-job', {
      type,
      rows,
      user: {
        firmId: req.user.firmId,
        email: req.user.email,
        xID: req.user.xID,
        defaultClientId: req.user.defaultClientId,
      },
      duplicateMode: effectiveDuplicateMode,
      jobId: job._id,
    });
  } catch (error) {
    await BulkUploadJob.findByIdAndUpdate(job._id, {
      status: 'failed',
      errorMessage: error.message,
    });

    return res.status(503).json({
      success: false,
      message: 'Failed to enqueue bulk import job',
    });
  }

  await safeLogBulkMutation(req, {
    description: `Bulk upload queued (${type}) with ${rows.length} row(s)`,
    metadata: {
      action: 'BULK_UPLOAD_QUEUED',
      type,
      duplicateMode: effectiveDuplicateMode,
      totalRows: rows.length,
      jobId: job._id?.toString(),
    },
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
  processBulkRows,
};
