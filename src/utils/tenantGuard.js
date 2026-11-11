const assertFirmContext = (req) => {
  const firmId = req?.user?.firmId || req?.firmId || req?.tenant?.id || req?.firm?.id || req?.ownershipFirmId;
  if (!firmId && req?.user?.role !== 'SUPER_ADMIN') {
    const error = new Error('Firm context missing');
    error.statusCode = 403;
    error.code = 'TENANT_CONTEXT_REQUIRED';
    throw error;
  }
};

module.exports = {
  assertFirmContext,
};
