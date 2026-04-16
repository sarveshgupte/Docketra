const buildResponse = ({ statusCode = 200, body = {}, headers = {}, cookies = [], clearCookies = [] } = {}) => ({
  statusCode,
  body,
  headers,
  cookies,
  clearCookies,
});

const buildSuccessResponse = ({ statusCode = 200, body = {} } = {}) => buildResponse({
  statusCode,
  body: {
    success: true,
    ...body,
  },
});

const buildErrorResponse = ({ statusCode = 500, message = 'Unexpected error', ...rest } = {}) => buildResponse({
  statusCode,
  body: {
    success: false,
    message,
    ...rest,
  },
});

const applyServiceResponse = (res, serviceResponse = {}) => {
  for (const [headerName, headerValue] of Object.entries(serviceResponse.headers || {})) {
    if (typeof res.setHeader === 'function') {
      res.setHeader(headerName, headerValue);
    } else if (typeof res.set === 'function') {
      res.set(headerName, headerValue);
    }
  }
  for (const cookieConfig of (serviceResponse.cookies || [])) {
    res.cookie(cookieConfig.name, cookieConfig.value, cookieConfig.options);
  }
  for (const cookieConfig of (serviceResponse.clearCookies || [])) {
    res.clearCookie(cookieConfig.name, cookieConfig.options);
  }
  return res.status(serviceResponse.statusCode || 200).json(serviceResponse.body);
};

const createResponseCapture = () => {
  let statusCode = 200;
  let body;
  const cookies = [];
  const clearCookies = [];
  const headers = {};
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    cookie: (name, value, options) => {
      cookies.push({ name, value, options });
      return res;
    },
    clearCookie: (name, options) => {
      clearCookies.push({ name, options });
      return res;
    },
    set: (key, value) => {
      if (key && typeof key === 'object') {
        Object.assign(headers, key);
      } else if (key) {
        headers[key] = value;
      }
      return res;
    },
    setHeader: (key, value) => {
      headers[key] = value;
      return res;
    },
    json: (payload) => {
      body = payload;
      return payload;
    },
  };
  return {
    res,
    getResult: () => ({ statusCode, body, cookies, clearCookies, headers }),
  };
};

module.exports = {
  buildResponse,
  buildSuccessResponse,
  buildErrorResponse,
  applyServiceResponse,
  createResponseCapture,
};
