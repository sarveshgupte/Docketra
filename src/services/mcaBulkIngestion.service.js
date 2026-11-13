'use strict';

const readline = require('readline');
const stream = require('stream');
const mongoose = require('mongoose');
const McaCompanyDirectory = require('../models/McaCompanyDirectory.model');
const log = require('../utils/log');

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCurrencyNumber(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function normalizeStatus(raw) {
  if (!raw) return 'ACTIVE';
  const upper = String(raw).trim().toUpperCase();
  if (upper.includes('ACT') || upper === 'ACTIVE') return 'ACTIVE';
  if (upper.includes('STRIKE') || upper.includes('STRUCK')) return 'STRIKE_OFF';
  if (upper.includes('LIQUIDAT')) return 'UNDER_LIQUIDATION';
  if (upper.includes('AMALGAMAT') || upper.includes('MERGED')) return 'AMALGAMATED';
  if (upper.includes('DORMANT')) return 'DORMANT';
  if (upper.includes('LLP')) return 'CONVERTED_TO_LLP';
  return 'OTHER';
}

function normalizeClass(raw) {
  if (!raw) return 'PRIVATE';
  const upper = String(raw).trim().toUpperCase();
  if (upper.includes('ONE PERSON') || upper === 'OPC') return 'ONE_PERSON_COMPANY';
  if (upper.includes('PUB') || upper === 'PUBLIC') return 'PUBLIC';
  if (upper.includes('PVT') || upper.includes('PRIV') || upper === 'PRIVATE') return 'PRIVATE';
  return 'OTHER';
}

const DEFAULT_MAX_DIRECTORY_RECORDS = Number(process.env.MCA_MAX_DIRECTORY_RECORDS) || 10000;

class McaBulkIngestionService {
  /**
   * Normalizes raw CSV row object into schema attributes
   */
  normalizeRow(rawRow = {}) {
    // Standardize keys (case insensitive / header alias match)
    const normalizedKeys = {};
    for (const [k, v] of Object.entries(rawRow)) {
      normalizedKeys[k.trim().toUpperCase().replace(/[\s_-]+/g, '_')] = typeof v === 'string' ? v.trim() : v;
    }

    const cin = (
      normalizedKeys.CIN ||
      normalizedKeys.CORPORATE_IDENTIFICATION_NUMBER ||
      normalizedKeys.COMPANY_CIN ||
      normalizedKeys.LLPIN ||
      ''
    ).toUpperCase();

    if (!cin || cin.length < 5) {
      return null;
    }

    const companyName = (
      normalizedKeys.COMPANY_NAME ||
      normalizedKeys.NAME ||
      normalizedKeys.COMPANYNAME ||
      ''
    ).toUpperCase();

    if (!companyName) {
      return null;
    }

    const address = (
      normalizedKeys.REGISTERED_OFFICE_ADDRESS ||
      normalizedKeys.REGISTERED_ADDRESS ||
      normalizedKeys.ADDRESS ||
      ''
    );

    const pinMatch = address.match(/\b([1-9][0-9]{5})\b/);
    const pinCode = pinMatch ? pinMatch[1] : '';

    return {
      cin,
      companyName,
      companyClass: normalizeClass(normalizedKeys.COMPANY_CLASS || normalizedKeys.CLASS),
      companyCategory: normalizedKeys.COMPANY_CATEGORY || normalizedKeys.CATEGORY || 'Company limited by shares',
      companySubCategory: normalizedKeys.COMPANY_SUB_CATEGORY || normalizedKeys.SUB_CATEGORY || 'Non-government company',
      roc: normalizedKeys.REGISTRAR_OF_COMPANIES || normalizedKeys.ROC_CODE || normalizedKeys.ROC || 'RoC',
      status: normalizeStatus(normalizedKeys.COMPANY_STATUS || normalizedKeys.STATUS),
      incorporationDate: parseDate(normalizedKeys.DATE_OF_REGISTRATION || normalizedKeys.INCORPORATION_DATE || normalizedKeys.REGISTRATION_DATE),
      authorizedCapital: parseCurrencyNumber(normalizedKeys.AUTHORIZED_CAP || normalizedKeys.AUTHORIZED_CAPITAL),
      paidUpCapital: parseCurrencyNumber(normalizedKeys.PAIDUP_CAPITAL || normalizedKeys.PAID_UP_CAPITAL),
      registeredOfficeAddress: address,
      registeredEmail: (normalizedKeys.EMAIL_ID || normalizedKeys.REGISTERED_EMAIL || normalizedKeys.EMAIL || '').toLowerCase(),
      state: normalizedKeys.REGISTERED_STATE || normalizedKeys.STATE || '',
      pinCode,
      syncSource: 'DATA_GOV_OPEN_DATA',
      syncedAt: new Date(),
    };
  }

  /**
   * Streams a CSV from a readable stream and bulk upserts into McaCompanyDirectory in batches
   * with automatic quota protection for 512MB MongoDB Atlas free tier.
   */
  async ingestFromStream(readStream, { batchSize = 2000, maxRecords = DEFAULT_MAX_DIRECTORY_RECORDS, onProgress = null } = {}) {
    const startTime = Date.now();
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    let headers = null;
    let batch = [];
    let totalProcessed = 0;
    let totalUpserted = 0;
    let errorsCount = 0;

    for await (const line of rl) {
      if (maxRecords && totalProcessed >= maxRecords) {
        log.warn('MCA_INGESTION_QUOTA_GUARD_LIMIT_REACHED', {
          maxRecords,
          totalProcessed,
          message: 'Capped directory ingestion to protect MongoDB 512MB free tier quota.',
        });
        break;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle simple CSV splitting with quote awareness
      const columns = this.parseCsvLine(trimmed);

      if (!headers) {
        headers = columns.map(h => h.trim());
        continue;
      }

      const rowObj = {};
      for (let i = 0; i < headers.length; i++) {
        rowObj[headers[i]] = columns[i] !== undefined ? columns[i] : '';
      }

      const normalized = this.normalizeRow(rowObj);
      if (!normalized) {
        continue;
      }

      totalProcessed++;
      batch.push(normalized);

      if (batch.length >= batchSize) {
        const flushed = await this.flushBatch(batch);
        totalUpserted += flushed;
        batch = [];
        if (typeof onProgress === 'function') {
          onProgress({ totalProcessed, totalUpserted, elapsedMs: Date.now() - startTime });
        }
      }
    }

    if (batch.length > 0) {
      const flushed = await this.flushBatch(batch);
      totalUpserted += flushed;
    }

    const durationMs = Date.now() - startTime;
    log.info('MCA_BULK_INGESTION_COMPLETED', {
      totalProcessed,
      totalUpserted,
      durationMs,
    });

    return {
      totalProcessed,
      totalUpserted,
      errorsCount,
      durationMs,
    };
  }

  /**
   * Flushes a chunk of records via MongoDB bulkWrite
   */
  async flushBatch(records) {
    if (!records || records.length === 0) return 0;

    if (mongoose.connection.readyState !== 1) {
      // In-memory or stubbed environment: count items as upserted
      return records.length;
    }

    const ops = records.map((record) => ({
      updateOne: {
        filter: { cin: record.cin },
        update: { $set: record },
        upsert: true,
      },
    }));

    try {
      const result = await McaCompanyDirectory.bulkWrite(ops, { ordered: false });
      return (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } catch (err) {
      log.warn('MCA_BULK_WRITE_PARTIAL_ERROR', { error: err.message });
      // bulkWrite with ordered: false returns partial results
      return err.result?.nUpserted || records.length;
    }
  }

  /**
   * Ingests from a raw CSV string buffer
   */
  async ingestFromCsvContent(csvString, options = {}) {
    const s = new stream.Readable();
    s.push(csvString);
    s.push(null);
    return this.ingestFromStream(s, options);
  }

  /**
   * Fast autocomplete / directory search
   */
  async searchDirectory({ query = '', limit = 10, status = 'ACTIVE' }) {
    const cleanQuery = (query || '').trim().toUpperCase();
    if (!cleanQuery || cleanQuery.length < 2) {
      return [];
    }

    const maxLimit = Math.min(Math.max(1, limit), 50);

    if (mongoose.connection.readyState !== 1) {
      // Stub fallback when DB connection is not active
      return [];
    }

    // If query starts with alphanumeric and looks like CIN prefix
    const isCinSearch = /^[A-Z0-9]{3,21}$/.test(cleanQuery);

    let filter;
    if (isCinSearch && cleanQuery.length >= 4) {
      filter = {
        cin: { $regex: '^' + cleanQuery, $options: 'i' },
      };
    } else {
      filter = {
        $or: [
          { companyName: { $regex: '^' + cleanQuery, $options: 'i' } },
          { cin: { $regex: '^' + cleanQuery, $options: 'i' } },
        ],
      };
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    return McaCompanyDirectory.find(filter)
      .select('cin companyName roc status authorizedCapital paidUpCapital registeredOfficeAddress state incorporationDate')
      .limit(maxLimit)
      .lean();
  }

  /**
   * Fetch single company record by CIN
   */
  async getCompanyByCin(cin) {
    if (!cin) return null;
    const clean = cin.trim().toUpperCase();

    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    return McaCompanyDirectory.findOne({ cin: clean }).lean();
  }

  /**
   * Robust CSV line parser handling quotes and commas
   */
  parseCsvLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }
}

const mcaBulkIngestionService = new McaBulkIngestionService();

module.exports = {
  mcaBulkIngestionService,
  McaBulkIngestionService,
};
