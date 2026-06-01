const Case = require('../models/Case.model');
const { requestApproval, decideApproval } = require('../services/docketApproval.service');

const getDocketApprovalStage = async (req, res) => {
  try {
    const docket = await Case.findOne({
      firmId: req.user.firmId,
      $or: [{ caseId: req.params.caseId }, { caseNumber: req.params.caseId }],
    }).select('caseId caseNumber compliance_state approval_stage approval_history').lean();
    if (!docket) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }
    return res.json({
      success: true,
      data: {
        caseId: docket.caseId || docket.caseNumber,
        complianceState: docket.compliance_state,
        approvalStage: docket.approval_stage || null,
        approvalHistory: Array.isArray(docket.approval_history) ? docket.approval_history : [],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load approval stage' });
  }
};

const requestDocketApproval = async (req, res) => {
  try {
    const docket = await requestApproval({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      requestedByXID: req.user.xID || req.user.xid,
      approvalType: req.body?.approvalType,
      approverXID: req.body?.approver,
      dueAt: req.body?.dueAt,
      comments: req.body?.comments,
      evidenceAttachmentId: req.body?.evidenceAttachmentId,
      resumeToState: req.body?.resumeToState,
    });
    return res.json({
      success: true,
      data: {
        caseId: docket.caseId || docket.caseNumber,
        complianceState: docket.compliance_state,
        approvalStage: docket.approval_stage || null,
      },
      message: 'Approval requested',
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 400)).json({ success: false, message: error?.message || 'Failed to request approval' });
  }
};

const decideDocketApproval = async (req, res) => {
  try {
    const docket = await decideApproval({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      actorXID: req.user.xID || req.user.xid,
      decision: req.body?.decision,
      comment: req.body?.comment,
    });
    return res.json({
      success: true,
      data: {
        caseId: docket.caseId || docket.caseNumber,
        complianceState: docket.compliance_state,
        approvalStage: docket.approval_stage || null,
      },
      message: `Approval ${String(req.body?.decision || '').toLowerCase()}`,
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 400)).json({ success: false, message: error?.message || 'Failed to update approval decision' });
  }
};

module.exports = {
  getDocketApprovalStage,
  requestDocketApproval,
  decideDocketApproval,
};
