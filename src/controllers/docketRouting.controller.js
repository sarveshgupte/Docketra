const {
  routeDocket,
  acceptRoutedDocket,
  returnRoutedDocket,
  transitionRoutedTeamStatus,
} = require('../services/docketRouting.service');

const handleError = (res, error) => {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  return res.status(status).json({ success: false, message: error.message || 'Unable to process routing action' });
};

const routeCaseToTeam = async (req, res) => {
  try {
    const docket = await routeDocket({
      docketId: req.params.caseId,
      actor: req.user,
      firmId: req.user.firmId,
      toTeamId: req.body?.toTeamId,
      note: req.body?.note,
    });
    return res.json({ success: true, data: docket, message: 'Docket routed successfully' });
  } catch (error) {
    return handleError(res, error);
  }
};

const acceptRoutedCase = async (req, res) => {
  try {
    const docket = await acceptRoutedDocket({ docketId: req.params.caseId, actor: req.user, firmId: req.user.firmId });
    return res.json({ success: true, data: docket, message: 'Docket accepted' });
  } catch (error) {
    return handleError(res, error);
  }
};

const returnRoutedCase = async (req, res) => {
  try {
    const docket = await returnRoutedDocket({
      docketId: req.params.caseId,
      actor: req.user,
      firmId: req.user.firmId,
      note: req.body?.note,
    });
    return res.json({ success: true, data: docket, message: 'Docket returned to owner team' });
  } catch (error) {
    return handleError(res, error);
  }
};

const updateRoutedCaseStatus = async (req, res) => {
  try {
    const docket = await transitionRoutedTeamStatus({
      docketId: req.params.caseId,
      actor: req.user,
      firmId: req.user.firmId,
      status: req.body?.status,
    });
    return res.json({ success: true, data: docket, message: 'Routed docket status updated' });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  routeCaseToTeam,
  acceptRoutedCase,
  returnRoutedCase,
  updateRoutedCaseStatus,
};
