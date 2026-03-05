const assertFirmContext = (req) => {
  if (!req?.user?.firmId && req?.user?.role !== 'SUPER_ADMIN') {
    const error = new Error('Firm context missing');
    error.statusCode = 403;
    error.code = 'TENANT_CONTEXT_REQUIRED';
    throw error;
  }
};

module.exports = {
  assertFirmContext,
};
