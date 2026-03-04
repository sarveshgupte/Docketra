// TENANT SAFETY: Firm-scoped query enforcement layer
const requireFirmScopedQuery = (query = {}, firmId) => {
  if (!firmId) {
    throw new Error('TenantId required');
  }
  if (query && Object.prototype.hasOwnProperty.call(query, 'firmId')) {
    throw new Error('Do not provide firmId in query; pass firmId as a dedicated argument');
  }
  return { firmId, ...query };
};

module.exports = { requireFirmScopedQuery };
