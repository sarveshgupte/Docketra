'use strict';

const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const { enqueueClientMcaSyncJob } = require('../queues/mcaSync.queue');
const { processClientMcaSyncJob } = require('../jobs/mcaSync.job');
const log = require('../utils/log');

class CorporateComplianceService {
  /**
   * Triggers an on-demand synchronization for a given CIN/LLPIN
   */
  async syncCompanyRecord({ firmId, clientId, cinOrLlpin, actorXID, runSynchronous = false }) {
    if (!firmId || !cinOrLlpin) {
      throw new Error('FIRM_ID_AND_CIN_REQUIRED');
    }

    const payload = {
      firmId,
      clientId: clientId || null,
      cinOrLlpin: cinOrLlpin.trim().toUpperCase(),
      actorXID: actorXID || 'SYSTEM',
    };

    if (!runSynchronous && process.env.REDIS_URL) {
      const enqueueResult = await enqueueClientMcaSyncJob(payload);
      if (enqueueResult.queued) {
        log.info('CORPORATE_COMPLIANCE_SYNC_ENQUEUED', { firmId, cinOrLlpin: payload.cinOrLlpin });
        return { queued: true, jobId: enqueueResult.jobId };
      }
    }

    // Direct synchronous execution fallback
    log.info('CORPORATE_COMPLIANCE_SYNC_DIRECT', { firmId, cinOrLlpin: payload.cinOrLlpin });
    const result = await processClientMcaSyncJob(payload);
    return { queued: false, record: result.record };
  }

  /**
   * Retrieves a single corporate master record by CIN or Client ID
   */
  async getRecord({ firmId, cinOrLlpin, clientId }) {
    const filter = { firmId };
    if (cinOrLlpin) {
      filter.cinOrLlpin = cinOrLlpin.trim().toUpperCase();
    } else if (clientId) {
      filter.clientId = clientId;
    } else {
      throw new Error('CIN_OR_CLIENT_ID_REQUIRED');
    }

    return CorporateMasterRecord.findOne(filter);
  }

  /**
   * Lists corporate records for a firm with filtering and pagination
   */
  async listRecords({ firmId, status, page = 1, limit = 50 }) {
    const filter = { firmId };
    if (status) {
      filter.status = status;
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const [records, total] = await Promise.all([
      CorporateMasterRecord.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CorporateMasterRecord.countDocuments(filter),
    ]);

    return {
      records,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Identifies compliance alerts across all client companies of a firm:
   * - Expiring DSC tokens (within specified days, default 30)
   * - Pending / Overdue DIR-3 KYC
   * - Upcoming AGMs
   */
  async getComplianceAlerts({ firmId, dscThresholdDays = 30 }) {
    const records = await CorporateMasterRecord.find({ firmId, status: 'ACTIVE' }).lean();

    const now = new Date();
    const dscExpiryLimit = new Date(now.getTime() + dscThresholdDays * 24 * 60 * 60 * 1000);

    const alerts = {
      expiringDscs: [],
      pendingDir3Kyc: [],
      upcomingAgms: [],
    };

    for (const record of records) {
      // Check Directors
      for (const director of record.directors || []) {
        if (director.dscToken && director.dscToken.validUntil) {
          const validUntil = new Date(director.dscToken.validUntil);
          if (validUntil <= dscExpiryLimit) {
            alerts.expiringDscs.push({
              companyName: record.companyName,
              cinOrLlpin: record.cinOrLlpin,
              clientId: record.clientId,
              directorName: director.fullName,
              din: director.din,
              validUntil,
              isExpired: validUntil < now,
              physicalLocation: director.dscToken.physicalLocation,
            });
          }
        }

        if (director.dir3KycStatus === 'PENDING' || director.dir3KycStatus === 'OVERDUE') {
          alerts.pendingDir3Kyc.push({
            companyName: record.companyName,
            cinOrLlpin: record.cinOrLlpin,
            clientId: record.clientId,
            directorName: director.fullName,
            din: director.din,
            status: director.dir3KycStatus,
            dueDate: director.dir3KycDueDate,
          });
        }
      }

      // Check upcoming AGM
      if (record.agmDueDate) {
        const agmDate = new Date(record.agmDueDate);
        const daysUntilAgm = Math.ceil((agmDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntilAgm <= 60 && daysUntilAgm >= -15) {
          alerts.upcomingAgms.push({
            companyName: record.companyName,
            cinOrLlpin: record.cinOrLlpin,
            clientId: record.clientId,
            agmDueDate: agmDate,
            daysUntilDue: daysUntilAgm,
            annualFilingDueDate: record.annualFilingDueDate,
          });
        }
      }
    }

    return alerts;
  }
}

module.exports = {
  corporateComplianceService: new CorporateComplianceService(),
};
