'use strict';

const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const { fetchCompanyMasterData } = require('../services/mcaDataFetcher.service');
const log = require('../utils/log');

async function processClientMcaSyncJob(payload = {}) {
  const { firmId, clientId, cinOrLlpin, actorXID, source } = payload;
  if (!firmId || !cinOrLlpin) {
    throw new Error('MCA_SYNC_MISSING_REQUIRED_PARAMS: firmId and cinOrLlpin are mandatory');
  }

  log.info('MCA_SYNC_JOB_STARTED', { firmId, clientId, cinOrLlpin });

  // 1. Fetch Master Data
  const masterData = await fetchCompanyMasterData(cinOrLlpin, { source });

  // 2. Upsert CorporateMasterRecord under firmId & cinOrLlpin
  let record = await CorporateMasterRecord.findOne({ firmId, cinOrLlpin: masterData.cinOrLlpin });
  if (!record) {
    record = new CorporateMasterRecord({
      firmId,
      cinOrLlpin: masterData.cinOrLlpin,
      clientId: clientId || null,
      companyName: masterData.companyName,
    });
  }

  // Update properties
  record.companyName = masterData.companyName;
  record.companyClass = masterData.companyClass;
  record.companyCategory = masterData.companyCategory || record.companyCategory;
  record.roc = masterData.roc;
  record.status = masterData.status;
  record.incorporationDate = masterData.incorporationDate;
  record.authorizedCapital = masterData.authorizedCapital;
  record.paidUpCapital = masterData.paidUpCapital;
  record.registeredOfficeAddress = masterData.registeredOfficeAddress;
  record.registeredEmail = masterData.registeredEmail;
  record.lastAgmDate = masterData.lastAgmDate;
  record.lastBalanceSheetDate = masterData.lastBalanceSheetDate;
  record.agmDueDate = masterData.agmDueDate;
  record.annualFilingDueDate = masterData.annualFilingDueDate;
  record.directors = masterData.directors || [];
  record.charges = masterData.charges || [];
  record.filings = masterData.filings || [];
  record.lastSyncedAt = new Date();
  record.syncStatus = 'SUCCESS';
  record.syncError = null;
  record.syncSource = masterData.syncSource || 'PUBLIC_REGISTRY_MIRROR';

  if (clientId) {
    record.clientId = clientId;
  }

  await record.save();

  // 3. Automated Task / Compliance Calendar integration (Graceful optional Task creation)
  try {
    const mongoose = require('mongoose');
    const Task = require('../models/Task');
    if (Task && mongoose.connection.readyState === 1 && record.agmDueDate && record.clientId) {
      const existingTask = await Task.findOne({
        firmId,
        client: record.clientId,
        type: 'AGM_COMPLIANCE',
      });

      if (!existingTask) {
        await Task.create({
          firmId,
          client: record.clientId,
          type: 'AGM_COMPLIANCE',
          title: `Annual Filing & AGM Compliance - ${record.companyName}`,
          dueDate: record.agmDueDate,
          status: 'PENDING',
          priority: 'HIGH',
          createdBy: actorXID || 'SYSTEM_MCA_WORKER',
          description: `Auto-generated compliance docket for ${record.companyName} (${record.cinOrLlpin}). RoC: ${record.roc}. Authorized Capital: ₹${record.authorizedCapital.toLocaleString('en-IN')}.`,
        });
        log.info('MCA_COMPLIANCE_TASK_GENERATED', { firmId, clientId: record.clientId, cin: record.cinOrLlpin });
      }
    }
  } catch (taskErr) {
    // Non-fatal if Task model isn't active or fails validation in mock envs
    log.warn('MCA_COMPLIANCE_TASK_OPTIONAL_SKIPPED', { error: taskErr.message });
  }

  log.info('MCA_SYNC_JOB_COMPLETED', {
    firmId,
    clientId: record.clientId,
    cinOrLlpin: record.cinOrLlpin,
    directorsCount: record.directors.length,
    chargesCount: record.charges.length,
  });

  return { success: true, record };
}

module.exports = {
  processClientMcaSyncJob,
};
