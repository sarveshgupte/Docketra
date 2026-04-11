const Case = require('../models/Case.model');

const canAccessDocket = (user, docket) => {
  if (!user || !docket) return false;
  const userTeamId = String(user.teamId || '');
  return Boolean(
    (docket.ownerTeamId && String(docket.ownerTeamId) === userTeamId)
    || (docket.routedToTeamId && String(docket.routedToTeamId) === userTeamId)
  );
};

const requireDocketAccess = async (req, res, next) => {
  try {
    const caseId = req.params?.caseId;
    const docket = await Case.findOne({ caseId, firmId: req.user?.firmId })
      .select('caseId ownerTeamId routedToTeamId')
      .lean();

    if (!docket) {
      return res.status(404).json({ success: false, message: 'Docket not found' });
    }

    if (!canAccessDocket(req.user, docket)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to docket' });
    }

    req.docketAccessRecord = docket;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to validate docket access' });
  }
};

module.exports = {
  canAccessDocket,
  requireDocketAccess,
};
