'use strict';

const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/mcaCompliance.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { corporateComplianceService } = require('../services/corporateCompliance.service');
const { mcaFilingAutomationService } = require('../services/mcaFilingAutomation.service');
const { statutoryDraftingService } = require('../services/statutoryDrafting.service');
const CorporateFilingDraft = require('../models/CorporateFilingDraft.model');
const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const log = require('../utils/log');

const router = applyRouteValidation(express.Router(), routeSchemas);

const getFirmId = (req) => req.firmId || req.firm?.id || req.user?.firmId;
const getActorXID = (req) => req.user?.xID || 'SYSTEM';

/**
 * Trigger sync of MCA master data for a CIN/LLPIN
 */
router.post('/sync', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const { cinOrLlpin, clientId, runSynchronous } = req.body;
    const actorXID = getActorXID(req);

    const result = await corporateComplianceService.syncCompanyRecord({
      firmId,
      clientId,
      cinOrLlpin,
      actorXID,
      runSynchronous: Boolean(runSynchronous),
    });

    return res.status(200).json({
      success: true,
      message: result.queued ? 'Sync job enqueued successfully' : 'Corporate master data synced successfully',
      data: result,
    });
  } catch (error) {
    log.error('MCA_COMPLIANCE_SYNC_ROUTE_ERROR', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * List corporate master records for the firm
 */
router.get('/records', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const { status, page = 1, limit = 50 } = req.query;

    const result = await corporateComplianceService.listRecords({
      firmId,
      status,
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('MCA_COMPLIANCE_LIST_RECORDS_ERROR', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get single corporate master record by CIN
 */
router.get('/records/:cin', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const record = await corporateComplianceService.getRecord({
      firmId,
      cinOrLlpin: req.params.cin,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Corporate record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    log.error('MCA_COMPLIANCE_GET_RECORD_ERROR', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Identify compliance alerts across client companies (DSC tokens, DIR-3 KYC, AGMs)
 */
router.get('/alerts', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const dscThresholdDays = req.query.dscThresholdDays ? Number(req.query.dscThresholdDays) : 30;

    const alerts = await corporateComplianceService.getComplianceAlerts({
      firmId,
      dscThresholdDays,
    });

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    log.error('MCA_COMPLIANCE_ALERTS_ERROR', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Create or save an annual filing draft (AOC-4 or MGT-7) with validation
 */
router.post('/filings/draft', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const actorXID = getActorXID(req);
    const { cinOrLlpin, formType, financialYear, clientId, caseId, filingData, attachments } = req.body;

    const normalizedFormType = String(formType).replace('-', '_').toUpperCase();

    const draft = await mcaFilingAutomationService.saveFilingDraft({
      firmId,
      clientId,
      cinOrLlpin,
      formType: normalizedFormType,
      financialYear,
      filingData: filingData || {},
      attachments: attachments || [],
      actorXID,
      caseId,
    });

    return res.status(200).json({
      success: true,
      message: 'Filing draft evaluated and saved',
      data: draft,
    });
  } catch (error) {
    log.error('MCA_FILING_DRAFT_SAVE_ERROR', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get review payload for a filing draft including diagnostics & checklist
 */
router.get('/filings/:id/review', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const draft = await CorporateFilingDraft.findOne({ _id: req.params.id, firmId }).lean();

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Filing draft not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    log.error('MCA_FILING_REVIEW_ERROR', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Export MCA V3 package for validated filing draft
 */
router.post('/filings/:id/export', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const draft = await CorporateFilingDraft.findOne({ _id: req.params.id, firmId });

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Filing draft not found',
      });
    }

    const exportPackage = mcaFilingAutomationService.exportMcaUploadPackage({ draft });

    return res.status(200).json({
      success: true,
      message: 'MCA V3 upload package exported successfully',
      data: exportPackage,
    });
  } catch (error) {
    log.error('MCA_FILING_EXPORT_ERROR', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Generate a statutory document draft (Board Report, AOC-1, AOC-2, MGT-9)
 */
router.post('/statutory/draft', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const actorXID = getActorXID(req);
    const { cinOrLlpin, documentType, financialYear, title, inputParameters = {}, caseId, clientId } = req.body;

    const corporateRecord = await CorporateMasterRecord.findOne({ firmId, cinOrLlpin: cinOrLlpin.trim().toUpperCase() });
    if (!corporateRecord) {
      return res.status(404).json({
        success: false,
        message: 'Corporate master record not found. Please sync the company first.',
      });
    }

    let generatedContent = '';
    if (documentType === 'BOARDS_REPORT') {
      generatedContent = statutoryDraftingService.generateBoardReport({
        corporateRecord,
        financialYear,
        ...inputParameters,
      });
    } else if (documentType === 'AOC_1') {
      generatedContent = statutoryDraftingService.generateAoc1Extract({
        corporateRecord,
        financialYear,
        subsidiaries: inputParameters.subsidiaries || [],
      });
    } else if (documentType === 'AOC_2') {
      generatedContent = statutoryDraftingService.generateAoc2Extract({
        corporateRecord,
        financialYear,
        contracts: inputParameters.contracts || [],
      });
    } else if (documentType === 'MGT_9') {
      generatedContent = statutoryDraftingService.generateMgt9Extract({
        corporateRecord,
        financialYear,
        ...inputParameters,
      });
    }

    const savedDraft = await statutoryDraftingService.saveDraftDocument({
      firmId,
      clientId,
      cinOrLlpin,
      financialYear,
      documentType,
      title,
      content: generatedContent,
      inputParameters,
      actorXID,
      caseId,
    });

    return res.status(200).json({
      success: true,
      message: 'Statutory draft generated and saved',
      data: savedDraft,
    });
  } catch (error) {
    log.error('STATUTORY_DRAFT_GENERATE_ERROR', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Request client sign-off on drafted statutory document
 */
router.post('/statutory/:id/signoff', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, async (req, res) => {
  try {
    const firmId = getFirmId(req);
    const actorXID = getActorXID(req);
    const { approverEmail, approverXID, approvalType = 'client', caseId } = req.body;

    const draft = await statutoryDraftingService.requestClientSignOff({
      draftId: req.params.id,
      firmId,
      approverEmail,
      approverXID,
      approvalType,
      actorXID,
      caseId,
    });

    return res.status(200).json({
      success: true,
      message: 'Statutory draft submitted for client sign-off',
      data: draft,
    });
  } catch (error) {
    log.error('STATUTORY_SIGNOFF_REQUEST_ERROR', { error: error.message });
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
