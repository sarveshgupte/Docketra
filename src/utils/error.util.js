const buildErrorBody = ({ message = 'Unexpected error', ...rest } = {}) => ({
  success: false,
  message,
  ...rest,
});

const buildErrorResult = ({ status = 500, message = 'Unexpected error', ...rest } = {}) => ({
  status,
  body: buildErrorBody({ message, ...rest }),
});

const mapErrorToResult = (error, { mappings = [], fallback = null } = {}) => {
  for (const mapping of mappings) {
    if (typeof mapping?.matches === 'function' && mapping.matches(error)) {
      if (typeof mapping.result === 'function') {
        return mapping.result(error);
      }
      if (mapping.result && typeof mapping.result === 'object') {
        return mapping.result;
      }
    }
  }

  if (typeof fallback === 'function') {
    return fallback(error);
  }
  if (fallback && typeof fallback === 'object') {
    return fallback;
  }

  return buildErrorResult();
};

const mapErrorToServiceResponse = (error, { mappings = [], fallback = null } = {}) => {
  const mappedResult = mapErrorToResult(error, { mappings, fallback });
  const statusCode = Number.isInteger(mappedResult?.statusCode)
    ? mappedResult.statusCode
    : (Number.isInteger(mappedResult?.status) ? mappedResult.status : 500);
  return {
    statusCode,
    body: mappedResult?.body || buildErrorBody(),
  };
};

module.exports = {
  buildErrorBody,
  buildErrorResult,
  mapErrorToResult,
  mapErrorToServiceResponse,
};
