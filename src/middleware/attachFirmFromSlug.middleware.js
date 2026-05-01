const { normalizeFirmSlug } = require('../utils/slugify');
const { isActiveStatus } = require('../utils/status.utils');
const { resolveTenantBySlug } = require('../services/tenantIdentity.service');

const buildFirmContext = (firm, fallbackSlug) => {
  const tenantId = firm?.tenantId ? String(firm.tenantId) : null;
  const firmSlug = firm?.firmSlug || fallbackSlug;

  return {
    _id: tenantId,
    id: tenantId,
    slug: firmSlug,
    firmSlug,
    name: firm?.firmName || null,
    status: firm?.status || null,
    legacyFirmId: firm?.legacyFirmId || null,
  };
};

const attachResolvedFirm = (req, firm, fallbackSlug) => {
  const tenantId = firm?.tenantId ? String(firm.tenantId) : null;
  const firmSlug = firm?.firmSlug || fallbackSlug;

  req.firm = buildFirmContext(firm, fallbackSlug);
  req.firmId = tenantId;
  req.firmIdString = firm?.firmIdString || tenantId;
  req.firmSlug = firmSlug;
  req.firmName = firm?.firmName || null;
  req.tenant = {
    id: tenantId,
    slug: firmSlug,
  };
  req.context = {
    ...(req.context || {}),
    firmId: tenantId,
    firmSlug,
    tenantId,
    tenantSlug: firmSlug,
  };
  req.params = {
    ...(req.params || {}),
    firmSlug,
  };
};

const attachFirmFromSlug = async (req, res, next) => {
  try {
    const rawFirmSlug = req.params?.firmSlug || req.body?.firmSlug || req.query?.firmSlug;
    const firmSlug = normalizeFirmSlug(rawFirmSlug);

    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'firmSlug is required',
      });
    }

    const firm = await resolveTenantBySlug(firmSlug);
    if (!firm?.tenantId || !isActiveStatus(firm.status)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid workspace URL',
      });
    }

    attachResolvedFirm(req, firm, firmSlug);

    return next();
  } catch (error) {
    return next(error);
  }
};

const attachOptionalFirmFromSlug = async (req, res, next) => {
  try {
    const rawFirmSlug = req.params?.firmSlug || req.body?.firmSlug || req.query?.firmSlug;
    const firmSlug = normalizeFirmSlug(rawFirmSlug);

    if (!firmSlug) {
      return next();
    }

    const firm = await resolveTenantBySlug(firmSlug);
    if (!firm?.tenantId || !isActiveStatus(firm.status)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid workspace URL',
      });
    }

    attachResolvedFirm(req, firm, firmSlug);

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { attachFirmFromSlug, attachOptionalFirmFromSlug };
