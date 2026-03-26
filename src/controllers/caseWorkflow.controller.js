const Case = require('../models/Case.model');
const CaseHistory = require('../models/CaseHistory.model');
const Comment = require('../models/Comment.model');
const { CaseRepository } = require('../repositories');
const CaseStatus = require('../domain/case/caseStatus');
const CaseService = require('../services/case.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');

/**
 * Case Workflow Controller
 * 
 * Handles case workflow state transitions:
 * DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → CLOSED
 * 
 * Enforces state transition rules and logs all changes
 */

/**
 * Submit a case (DRAFT → SUBMITTED)
 * POST /api/cases/:caseId/submit
 * 
 * Locks the case for editing after submission
 */
const submitCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    // Fetch case with firmId scoping for multi-tenancy
    let caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Verify user is the creator (only creator can submit from DRAFT)
    if (caseData.createdBy !== userEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Only the case creator can submit the case',
      });
    }
    
    // Verify case is in DRAFT status
    if (caseData.status !== CaseStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        message: `Case must be in DRAFT status to submit. Current status: ${caseData.status}`,
      });
    }
    
    // Update status to SUBMITTED via centralized service
    await CaseService.updateStatus(caseId, CaseStatus.SUBMITTED, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: req.user.xID,
      performedBy: userEmail.toLowerCase(),
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      req,
      currentStatus: caseData.status,
      statusPatch: {
        submittedAt: new Date(),
        submittedBy: userEmail.toLowerCase(),
      },
    });
    caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      firmId: req.user.firmId,
      actionType: 'Submitted',
      description: 'Case submitted for review',
      performedBy: userEmail.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case submitted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting case',
      error: error.message,
    });
  }
};

/**
 * Move case to under review (SUBMITTED → UNDER_REVIEW)
 * POST /api/cases/:caseId/review
 * 
 * Admin can move submitted cases to under review
 */
const moveToUnderReview = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    // Fetch case with firmId scoping for multi-tenancy
    let caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Verify case is in SUBMITTED status
    if (caseData.status !== CaseStatus.SUBMITTED) {
      return res.status(400).json({
        success: false,
        message: `Case must be in SUBMITTED status to review. Current status: ${caseData.status}`,
      });
    }
    
    // Update status to UNDER_REVIEW via centralized service
    await CaseService.updateStatus(caseId, CaseStatus.UNDER_REVIEW, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: req.user.xID,
      performedBy: userEmail.toLowerCase(),
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      req,
      currentStatus: oldStatus,
    });
    caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      firmId: req.user.firmId,
      actionType: 'UnderReview',
      description: 'Case moved to under review',
      performedBy: userEmail.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case moved to under review',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error moving case to review',
      error: error.message,
    });
  }
};

/**
 * Close a case
 * POST /api/cases/:caseId/close
 * 
 * Can be done from various states
 */
const closeCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail, comment } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    // Fetch case with firmId scoping for multi-tenancy
    let caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Cannot close already closed cases
    if (caseData.status === CaseStatus.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Case is already closed',
      });
    }

    const oldStatus = caseData.status;
    
    // Update status to CLOSED via centralized service
    await CaseService.updateStatus(caseId, CaseStatus.CLOSED, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: req.user.xID,
      performedBy: userEmail.toLowerCase(),
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      req,
      currentStatus: oldStatus,
    });
    caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    // Add comment if provided
    if (comment) {
      await Comment.create({
        caseId,
        firmId: req.user.firmId,
        text: comment,
        createdBy: userEmail.toLowerCase(),
        note: 'Case closure comment',
      });
    }
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      firmId: req.user.firmId,
      actionType: 'Closed',
      description: `Case closed from ${oldStatus} status${comment ? `. Comment: ${comment}` : ''}`,
      performedBy: userEmail.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case closed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error closing case',
      error: error.message,
    });
  }
};

/**
 * Reopen a case
 * POST /api/cases/:caseId/reopen
 * 
 * Moves closed/rejected cases back to DRAFT
 */
const reopenCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { userEmail, comment } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required',
      });
    }
    
    // Fetch case with firmId scoping for multi-tenancy
    let caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Can only reopen rejected cases
    const validStatuses = [CaseStatus.REJECTED];
    if (!validStatuses.includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only REJECTED cases can be reopened',
      });
    }
    
    const oldStatus = caseData.status;
    
    // Update status to DRAFT via centralized service
    await CaseService.updateStatus(caseId, CaseStatus.DRAFT, {
      tenantId: req.user.firmId,
      role: req.user.role,
      userId: req.user.xID,
      performedBy: userEmail.toLowerCase(),
      actorRole: req.user.role === 'Admin' ? 'ADMIN' : 'USER',
      req,
      currentStatus: caseData.status,
    });
    caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId, req.user.role);
    
    // Add comment if provided
    if (comment) {
      await Comment.create({
        caseId,
        firmId: req.user.firmId,
        text: comment,
        createdBy: userEmail.toLowerCase(),
        note: 'Case reopen comment',
      });
    }
    
    // Create history entry
    await CaseHistory.create({
      caseId,
      firmId: req.user.firmId,
      actionType: 'Reopened',
      description: `Case reopened from ${oldStatus} status${comment ? `. Comment: ${comment}` : ''}`,
      performedBy: userEmail.toLowerCase(),
    });
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case reopened successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reopening case',
      error: error.message,
    });
  }
};

module.exports = {
  submitCase: wrapWriteHandler(submitCase),
  moveToUnderReview: wrapWriteHandler(moveToUnderReview),
  closeCase: wrapWriteHandler(closeCase),
  reopenCase: wrapWriteHandler(reopenCase),
};
