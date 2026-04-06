const {
  DocketStatus,
  pullFromWorkbench,
  transition,
  qcDecision,
  reassign,
  reopenDuePending,
} = require('../services/docketWorkflow.service');
const { isValidTransition: isValidLifecycleTransition } = require('../domain/docketLifecycle');

function isAdmin(req) {
  return String(req.user?.role || '').toUpperCase() === 'ADMIN';
}


function isValidTransition(fromState, toState) {
  return isValidLifecycleTransition(fromState, toState);
}

function handleError(res, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  return res.status(status).json({ success: false, message: error.message || 'Unable to process docket action', code: error.code || 'DOCKET_ACTION_FAILED' });
}

async function assignDocket(req, res) {
  try {
    const { caseId } = req.params;
    const assigneeXID = req.body?.assigneeXID || req.user?.xID;
    if (!isAdmin(req) && String(assigneeXID || '').toUpperCase() !== String(req.user?.xID || '').toUpperCase()) {
      return res.status(403).json({ success: false, message: 'Only admin can assign to other users' });
    }

    const updated = await pullFromWorkbench({
      docketId: caseId,
      firmId: req.user.firmId,
      userId: req.user.xID,
      userObjectId: req.user._id,
      assignToXID: assigneeXID,
    });

    return res.json({ success: true, data: updated, message: 'Docket assigned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function transitionDocket(req, res) {
  try {
    const { caseId } = req.params;
    const { toState, comment, reopenAt, sendToQC, duplicateOf } = req.body || {};

    const updated = await transition({
      docketId: caseId,
      firmId: req.user.firmId,
      actor: req.user,
      toState,
      comment,
      reopenAt,
      sendToQC,
      duplicateOf,
    });

    return res.json({ success: true, data: updated, message: 'Docket transitioned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function reopenPendingDocket(req, res) {
  try {
    const { caseId } = req.params;
    const updated = await transition({
      docketId: caseId,
      firmId: req.user.firmId,
      actor: req.user,
      toState: DocketStatus.IN_PROGRESS,
      comment: req.body?.comment || 'Manually reopened',
    });
    return res.json({ success: true, data: updated, message: 'Docket reopened' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function qcAction(req, res) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Only admins can perform QC actions' });
    const { caseId } = req.params;
    const { decision, comment } = req.body || {};
    const updated = await qcDecision({ docketId: caseId, firmId: req.user.firmId, actor: req.user, decision, comment });
    return res.json({ success: true, data: updated, message: 'QC action applied' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function reassignDocket(req, res) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Only admins can reassign dockets' });
    const { caseId } = req.params;
    const { assigneeXID, comment } = req.body || {};
    const updated = await reassign({ docketId: caseId, firmId: req.user.firmId, actor: req.user, toUserXID: assigneeXID, comment });
    return res.json({ success: true, data: updated, message: 'Docket reassigned' });
  } catch (error) {
    return handleError(res, error);
  }
}

async function runPendingReopen(req, res) {
  try {
    const result = await reopenDuePending();
    return res.json({ success: true, data: result, message: `Reopened ${result.count} docket(s)` });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  isValidTransition,
  assignDocket,
  transitionDocket,
  qcAction,
  reassignDocket,
  reopenPendingDocket,
  runPendingReopen,
};
