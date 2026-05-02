const { isSuperAdminRole } = require('../utils/role.utils');

const noFirmNoTransaction = (req, _res, next) => {
  if (isSuperAdminRole(req.user?.role)) {
    return next();
  }
  req.skipFirmContext = true;
  req.skipTransaction = true;
  next();
};
module.exports = { noFirmNoTransaction };
