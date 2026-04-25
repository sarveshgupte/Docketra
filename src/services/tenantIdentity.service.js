const Client = require('../models/Client.model');
const Firm = require('../models/Firm.model');
const mongoose = require('mongoose');

const toIdString = (value) => (value ? String(value) : null);
const maybeSelect = (query, projection) => (
  query && typeof query.select === 'function' ? query.select(projection) : query
);
const maybeSession = (query, session) => {
  if (session && query && typeof query.session === 'function') {
    query.session(session);
  }
  return query;
};
const execLean = async (query) => (
  query && typeof query.lean === 'function' ? query.lean() : query
);

const resolveCanonicalTenantFromFirmId = async (firmId, { session = null } = {}) => {
  if (!firmId) return null;

  const directDefaultClientQuery = maybeSelect(Client.findOne({
    _id: firmId,
    isDefaultClient: true,
  }), '_id firmId firmSlug businessName status');
  maybeSession(directDefaultClientQuery, session);
  const directDefaultClient = await execLean(directDefaultClientQuery);
  if (directDefaultClient) {
    return {
      tenantId: toIdString(directDefaultClient._id),
      defaultClientId: toIdString(directDefaultClient._id),
      ownershipFirmId: toIdString(directDefaultClient.firmId) || toIdString(directDefaultClient._id),
      legacyFirmId: null,
      firmSlug: directDefaultClient.firmSlug || null,
      firmName: directDefaultClient.businessName || null,
      status: directDefaultClient.status || null,
      source: 'default_client',
    };
  }

  const legacyFirmQuery = maybeSelect(Firm.findById(firmId), '_id defaultClientId firmSlug status');
  maybeSession(legacyFirmQuery, session);
  const legacyFirm = await execLean(legacyFirmQuery);
  if (!legacyFirm) return null;

  if (legacyFirm.defaultClientId) {
    const defaultClientQuery = maybeSelect(Client.findOne({
      _id: legacyFirm.defaultClientId,
      isDefaultClient: true,
    }), '_id firmId firmSlug status');
    maybeSession(defaultClientQuery, session);
    const defaultClient = await execLean(defaultClientQuery);
    if (defaultClient) {
      return {
        tenantId: toIdString(defaultClient._id),
        defaultClientId: toIdString(defaultClient._id),
        ownershipFirmId: toIdString(legacyFirm._id),
        legacyFirmId: toIdString(legacyFirm._id),
        firmSlug: defaultClient.firmSlug || legacyFirm.firmSlug || null,
        firmName: legacyFirm.name || null,
        status: defaultClient.status || legacyFirm.status || null,
        source: 'legacy_firm_to_default_client',
      };
    }
  }

  return {
    tenantId: toIdString(legacyFirm._id),
    defaultClientId: null,
    ownershipFirmId: toIdString(legacyFirm._id),
    legacyFirmId: toIdString(legacyFirm._id),
    firmSlug: legacyFirm.firmSlug || null,
    firmName: legacyFirm.name || null,
    status: legacyFirm.status || null,
    source: 'legacy_firm_only',
  };
};

const resolveCanonicalTenantForUser = async (user, { session = null } = {}) => {
  if (!user || String(user.role || '').toUpperCase() === 'SUPER_ADMIN') {
    return {
      tenantId: null,
      defaultClientId: null,
      ownershipFirmId: null,
      legacyFirmId: null,
      firmSlug: null,
      source: 'super_admin',
    };
  }

  if (user.defaultClientId) {
    const defaultClientQuery = maybeSelect(Client.findOne({
      _id: user.defaultClientId,
      isDefaultClient: true,
    }), '_id firmId firmSlug status');
    maybeSession(defaultClientQuery, session);
    const defaultClient = await execLean(defaultClientQuery);
    if (defaultClient) {
      return {
        tenantId: toIdString(defaultClient._id),
        defaultClientId: toIdString(defaultClient._id),
        ownershipFirmId: toIdString(defaultClient.firmId) || toIdString(defaultClient._id),
        legacyFirmId: user.firmId && toIdString(user.firmId) !== toIdString(defaultClient._id)
          ? toIdString(user.firmId)
          : null,
        firmSlug: defaultClient.firmSlug || null,
        firmName: null,
        status: defaultClient.status || null,
        source: 'user_default_client',
      };
    }
  }

  return resolveCanonicalTenantFromFirmId(user.firmId, { session });
};

const resolveTenantBySlug = async (firmSlug, { session = null } = {}) => {
  if (!firmSlug) return null;

  const defaultClientQuery = maybeSelect(Client.findOne({
    firmSlug,
    isDefaultClient: true,
  }), '_id firmId firmSlug businessName status');
  maybeSession(defaultClientQuery, session);
  const defaultClient = await execLean(defaultClientQuery);
  if (defaultClient) {
    return {
      tenantId: toIdString(defaultClient._id),
      defaultClientId: toIdString(defaultClient._id),
      ownershipFirmId: toIdString(defaultClient.firmId) || toIdString(defaultClient._id),
      legacyFirmId: toIdString(defaultClient.firmId) !== toIdString(defaultClient._id)
        ? toIdString(defaultClient.firmId)
        : null,
      firmSlug: defaultClient.firmSlug || firmSlug,
      firmName: defaultClient.businessName || null,
      status: defaultClient.status || null,
      source: 'default_client_slug',
    };
  }

  const firmQuery = maybeSelect(Firm.findOne({ firmSlug }), '_id firmId defaultClientId firmSlug name status');
  maybeSession(firmQuery, session);
  const firm = await execLean(firmQuery);
  if (!firm) return null;

  const canonicalFromFirm = await resolveCanonicalTenantFromFirmId(firm._id, { session });
  return {
    tenantId: canonicalFromFirm?.tenantId || toIdString(firm._id),
    defaultClientId: canonicalFromFirm?.defaultClientId || toIdString(firm.defaultClientId) || null,
    ownershipFirmId: canonicalFromFirm?.ownershipFirmId || toIdString(firm._id),
    legacyFirmId: toIdString(firm._id),
    firmSlug: canonicalFromFirm?.firmSlug || firm.firmSlug || null,
    firmName: firm.name || null,
    firmIdString: firm.firmId || null,
    status: canonicalFromFirm?.status || firm.status || null,
    source: canonicalFromFirm?.source || 'legacy_firm_slug',
  };
};

module.exports = {
  resolveCanonicalTenantFromFirmId,
  resolveCanonicalTenantForUser,
  resolveTenantBySlug,
  resolveClientOwnershipFirmId: async (firmId, options = {}) => {
    if (!firmId) return null;
    if (!mongoose.Types.ObjectId.isValid(String(firmId))) {
      return toIdString(firmId);
    }
    const context = await resolveCanonicalTenantFromFirmId(firmId, options);
    return context?.ownershipFirmId || (firmId ? toIdString(firmId) : null);
  },
};
